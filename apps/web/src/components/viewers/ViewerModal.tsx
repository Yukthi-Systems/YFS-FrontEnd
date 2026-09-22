import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  ExternalLink,
  File as FileIcon,
  Maximize2,
  Minimize2,
  Shrink,
  Video,
  X,
  Loader2,
} from "lucide-react";
import type { FileItem, InternalSharePermissions } from "../../types/file";
import { isItemFailed, isItemProcessing } from "../../utils/format";
import { isTextEditable, isCollaboraSupported, getCollaboraAccentColor } from "../../utils/fileType";
import { ImageLightbox } from "./ImageLightbox";
import { MediaPlayer } from "./MediaPlayer";
import type { CollaboraViewerHandle } from "./CollaboraViewer";

// pdf.js, CodeMirror, and SheetJS are heavy — only pull them into a bundle
// when a file of that type is actually opened.
const PdfViewer = lazy(() => import("./PdfViewer").then((m) => ({ default: m.PdfViewer })));
const SpreadsheetViewer = lazy(() => import("./SpreadsheetViewer").then((m) => ({ default: m.SpreadsheetViewer })));
const CodeEditor = lazy(() => import("./CodeEditor").then((m) => ({ default: m.CodeEditor })));
const DocViewer = lazy(() => import("./DocViewer").then((m) => ({ default: m.DocViewer })));
const CollaboraViewer = lazy(() =>
  import("./CollaboraViewer").then((m) => ({ default: m.CollaboraViewer }))
);

const WORD_EXTENSIONS = new Set(["doc", "docx"]);

// How long to hold the iframe open after asking Collabora to save-and-close (see
// CollaboraViewerHandle.requestExitSave) before we unmount it regardless. Collabora
// doesn't post back a confirmation we listen for, so this is a fixed grace period, not
// a real handshake — long enough for a save PUT to the WOPI host to go out, short
// enough that closing the viewer still feels instant.
const COLLABORA_EXIT_SAVE_GRACE_MS = 500;

const ViewerLoading = () => <div className="text-sm text-text-main text-center py-16">Loading viewer…</div>;

export function ViewerModal({
  item,
  siblings,
  onClose,
  onNavigate,
  onDownload,
  onSaveContent,
  permissions = null,
}: {
  item: FileItem;
  siblings: FileItem[];
  onClose: () => void;
  onNavigate: (item: FileItem) => void;
  onDownload: (item: FileItem) => void;
  onSaveContent: (id: string, blob: Blob) => void;
  // The caller's permissions when `item` lives in a "Shared with me" subtree; null
  // for the user's own items (full control) — same convention as ItemContextMenu.
  permissions?: InternalSharePermissions | null;
}) {
  const canEdit = !permissions || permissions.can_update;
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  // User-toggled "full view" for previews that default to a compact box (text, code, CSV, images).
  const [isExpanded, setIsExpanded] = useState(false);
  // Lets the header's "Open in new tab" button (next to Download) drive the Collabora
  // iframe's hidden form from up here, and know when there's actually a session to submit.
  const collaboraRef = useRef<CollaboraViewerHandle>(null);
  const [collaboraReady, setCollaboraReady] = useState(false);
  // True once Collabora's own ribbon has actually rendered (not just once a session
  // exists) — the toolbar strip only takes the document-type accent colour then, so it
  // doesn't show that colour over a bare "Opening in Collabora…" loading screen.
  const [collaboraFrameReady, setCollaboraFrameReady] = useState(false);

  const viewable = siblings.filter((f) => !f.isFolder);
  const index = viewable.findIndex((f) => f.id === item.id);
  const prevItem = index > 0 ? viewable[index - 1] : null;
  const nextItem = index >= 0 && index < viewable.length - 1 ? viewable[index + 1] : null;

  const isCollabora = isCollaboraSupported(item);

  // PDFs and office-suite documents (rendered via Collabora when server-backed) get a
  // near-fullscreen viewport instead of the narrower default box, since they're read as
  // full pages rather than a quick preview.
  const isOfficeDoc =
    item.type === "pdf" ||
    item.type === "spreadsheet" ||
    (item.type === "document" && !!item.extension && WORD_EXTENSIONS.has(item.extension)) ||
    isCollabora;

  useEffect(() => {
    setCollaboraReady(false);
    setCollaboraFrameReady(false);
  }, [item.id]);

  // PDFs/office docs are already near-fullscreen, and video/audio have their own player
  // controls — the expand toggle only applies to the rest.
  const canToggleExpand = !isOfficeDoc && item.type !== "video" && item.type !== "audio";
  const isFullView = isOfficeDoc || (canToggleExpand && isExpanded);

  // Ask Collabora to save-and-close first, then hold the grace period before actually
  // running `action` (unmounting via onClose, or swapping `item` via onNavigate) —
  // otherwise we'd just yank the iframe out from under it and lose anything edited
  // since its last autosave. No-op wrapper for every other file type.
  const withCollaboraExitSave = (action: () => void) => {
    if (!isCollabora) {
      action();
      return;
    }
    collaboraRef.current?.requestExitSave();
    window.setTimeout(action, COLLABORA_EXIT_SAVE_GRACE_MS);
  };

  const handleClose = () => {
    if (isPiPActive && !isMinimized) {
      // If PiP is actively playing, dock to bottom-right mini player instead of terminating PiP!
      setIsMinimized(true);
      return;
    }
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    setIsMinimized(false);
    withCollaboraExitSave(onClose);
  };

  const handleBackdropClick = () => {
    if (isMinimized) return;
    if (isPiPActive) {
      setIsMinimized(true);
    } else {
      // Routed through handleClose (not onClose directly) so a backdrop click gets the
      // same Collabora exit-save handling as the X button / Escape.
      handleClose();
    }
  };

  // Wraps onNavigate the same way handleClose wraps onClose — switching to a sibling
  // file is just as much "leaving" the current Collabora session as closing the modal is.
  const navigateTo = (target: FileItem) => withCollaboraExitSave(() => onNavigate(target));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        if (isPiPActive && !isMinimized) {
          setIsMinimized(true);
        } else {
          handleClose();
        }
      } else if (!isMinimized && e.key === "ArrowLeft" && prevItem) {
        navigateTo(prevItem);
      } else if (!isMinimized && e.key === "ArrowRight" && nextItem) {
        navigateTo(nextItem);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, onNavigate, prevItem, nextItem, isPiPActive, isMinimized]);

  const renderContent = () => {
    if (isItemFailed(item)) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 text-center text-text-main py-16">
          <div className="relative flex items-center justify-center">
            <FileIcon className="w-12 h-12 text-neutral-400" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-bg-main">
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            </span>
          </div>
          <div className="text-sm font-semibold text-text-heading">File failed to process</div>
          <div className="text-xs text-text-main max-w-sm">This file never finished processing on the server.</div>
        </div>
      );
    }
    if (isItemProcessing(item)) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 text-center text-text-main py-16">
          <div className="relative flex items-center justify-center">
            <FileIcon className="w-12 h-12 text-neutral-400" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-bg-main">
              <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
            </span>
          </div>
          <div className="text-sm font-semibold text-text-heading">File is currently processing</div>
          <div className="text-xs text-text-main max-w-sm">
            This file is being processed on the server. Preview will be available once processing completes.
          </div>
        </div>
      );
    }
    if (item.type === "image") return <ImageLightbox item={item} />;
    if (isCollabora) {
      return (
        <Suspense fallback={<ViewerLoading />}>
          <CollaboraViewer
            ref={collaboraRef}
            item={item}
            canEdit={canEdit}
            onReadyChange={setCollaboraReady}
            onFrameReadyChange={setCollaboraFrameReady}
          />
        </Suspense>
      );
    }
    if (item.type === "pdf") {
      return (
        <Suspense fallback={<ViewerLoading />}>
          <PdfViewer item={item} />
        </Suspense>
      );
    }
    if (item.type === "spreadsheet") {
      return (
        <Suspense fallback={<ViewerLoading />}>
          <SpreadsheetViewer item={item} onSave={(blob) => onSaveContent(item.id, blob)} />
        </Suspense>
      );
    }
    if (item.type === "video" || item.type === "audio") {
      return (
        <MediaPlayer
          item={item}
          size="full"
          isMinimized={isMinimized}
          onPiPChange={setIsPiPActive}
          onRestoreModal={() => setIsMinimized(false)}
        />
      );
    }
    if (item.type === "document" && item.extension && WORD_EXTENSIONS.has(item.extension)) {
      return (
        <Suspense fallback={<ViewerLoading />}>
          <DocViewer item={item} />
        </Suspense>
      );
    }
    if (isTextEditable(item)) {
      return (
        <Suspense fallback={<ViewerLoading />}>
          <CodeEditor item={item} fill={isFullView} onSave={(blob) => onSaveContent(item.id, blob)} />
        </Suspense>
      );
    }
    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main py-16">
        <FileIcon className="w-12 h-12 text-neutral-400" />
        <div className="text-sm font-medium">No preview available for this file type.</div>
      </div>
    );
  };

  // Title + action-buttons row for every viewer type except Collabora, which gets its
  // own floating buttons over Collabora's own toolbar instead (see collaboraLayout
  // below) — Collabora already shows the filename and a full ribbon, a second title bar
  // on top of it was pure duplication.
  const headerBar = (barClassName: string) => (
    <div
      className={`flex items-center justify-between text-white shrink-0 ${barClassName}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 truncate max-w-[65%]">
        {isMinimized && <Video className="w-4 h-4 text-rose-400 shrink-0" />}
        <span className="text-sm font-semibold truncate">{item.name}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {isMinimized ? (
          <>
            <button
              onClick={() => {
                setIsMinimized(false);
                if (document.pictureInPictureElement) {
                  document.exitPictureInPicture().catch(() => {});
                }
              }}
              className="border-none bg-white/10 hover:bg-white/20 p-1.5 rounded-lg text-white cursor-pointer transition flex items-center justify-center"
              title="Expand to Fullscreen / Modal"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleClose}
              className="border-none bg-white/10 hover:bg-white/20 p-1.5 rounded-lg text-white cursor-pointer transition flex items-center justify-center"
              title="Close Video"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            {item.type === "video" && (
              <button
                onClick={() => setIsMinimized(true)}
                className="border-none bg-white/10 hover:bg-white/20 p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition"
                title="Minimize to Floating Dock"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            )}
            {canToggleExpand && (
              <button
                onClick={() => setIsExpanded((v) => !v)}
                className="border-none bg-white/10 hover:bg-white/20 p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition"
                title={isExpanded ? "Exit full view" : "Full view"}
              >
                {isExpanded ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
              </button>
            )}
            {!item.isFolder && (
              <button
                onClick={() => onDownload(item)}
                disabled={isItemProcessing(item) || isItemFailed(item)}
                title={isItemFailed(item) ? "File failed to process" : isItemProcessing(item) ? "File is still processing" : "Download"}
                className="border-none bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleClose}
              className="border-none bg-white/10 hover:bg-white/20 p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  // Collabora gets its own layout: the title bar becomes the top strip of a single panel
  // inset exactly 16px from every edge of the backdrop (~98% of the screen either way),
  // instead of a full-width header pushing a separately-inset content box down from below
  // it. Prev/next float directly on the backdrop so they don't cost the panel any width.
  const collaboraLayout = !isMinimized && isCollabora;

  return (
    <div
      className={`fixed z-[1500] transition-all duration-300 ${
        isMinimized
          ? "bottom-6 right-6 w-88 shadow-2xl rounded-2xl bg-neutral-900 border border-white/20 overflow-hidden flex flex-col"
          : "inset-0 bg-black/60 backdrop-blur-sm flex flex-col animate-fade-in"
      }`}
      onClick={handleBackdropClick}
    >
      {collaboraLayout ? (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (prevItem) navigateTo(prevItem);
            }}
            disabled={!prevItem}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 border-none bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition backdrop-blur-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="absolute inset-4 flex flex-col overflow-hidden rounded-2xl shadow-lg bg-bg-main">
            {/* A real docked strip, not a floating overlay — coloured to match Collabora's
                own ribbon for this document type (see getCollaboraAccentColor) so it reads
                as one continuous native bar instead of a disconnected dark pill group. No
                filename here: Collabora's ribbon already shows it directly below.
                Stays neutral until collaboraFrameReady — before that, there's no ribbon
                behind it yet (just "Opening in Collabora…"), so the accent colour would be
                floating over nothing. */}
            <div
              className="flex items-center justify-end gap-1 px-2 py-1.5 shrink-0 transition-colors duration-300"
              style={{ backgroundColor: collaboraFrameReady ? getCollaboraAccentColor(item.extension) : "#171717" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => collaboraRef.current?.openInNewTab()}
                disabled={!collaboraReady}
                title={collaboraReady ? "Open in a new tab (use this if the editor stays blank)" : "Waiting for the editor session…"}
                className="border-none bg-transparent hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed p-1.5 rounded-full text-white cursor-pointer flex items-center justify-center transition"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              {!item.isFolder && (
                <button
                  onClick={() => onDownload(item)}
                  disabled={isItemProcessing(item) || isItemFailed(item)}
                  title={isItemFailed(item) ? "File failed to process" : isItemProcessing(item) ? "File is still processing" : "Download"}
                  className="border-none bg-transparent hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed p-1.5 rounded-full text-white cursor-pointer flex items-center justify-center transition"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleClose}
                className="border-none bg-transparent hover:bg-white/20 p-1.5 rounded-full text-white cursor-pointer flex items-center justify-center transition"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative flex-1 min-h-0 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {renderContent()}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (nextItem) navigateTo(nextItem);
            }}
            disabled={!nextItem}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 border-none bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition backdrop-blur-sm"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      ) : (
        <>
          {headerBar(isMinimized ? "px-3.5 py-2.5 bg-neutral-950/90 border-b border-white/10" : "px-6 py-4")}

          <div
            className={`flex-1 flex items-center justify-center overflow-hidden transition-all ${
              isMinimized ? "p-0 h-48 max-h-48" : "gap-4 px-4 pb-6"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {!isMinimized && (
              <button
                onClick={() => prevItem && navigateTo(prevItem)}
                disabled={!prevItem}
                className="border-none bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <div
              className={`flex flex-col overflow-hidden transition-all ${
                isMinimized
                  ? "w-full h-full bg-black rounded-none shadow-none"
                  : `bg-bg-main rounded-2xl shadow-lg ${isFullView ? "w-[97%] h-[95%]" : "w-full max-w-3xl max-h-full"}`
              }`}
            >
              <div className={`flex-1 min-h-0 overflow-y-auto ${isMinimized ? "p-0" : "p-6"}`}>{renderContent()}</div>
            </div>

            {!isMinimized && (
              <button
                onClick={() => nextItem && navigateTo(nextItem)}
                disabled={!nextItem}
                className="border-none bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition shrink-0"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
