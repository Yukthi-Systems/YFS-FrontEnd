/*
 * Copyright (C) 2026 Yukthi Systems Private Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * version 3 along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */

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
import { isTextEditable, isCollaboraSupported } from "../../utils/fileType";
import { ImageLightbox } from "./ImageLightbox";
import { MediaPlayer } from "./MediaPlayer";
import type { CollaboraViewerHandle } from "./CollaboraViewer";

// Heavy viewers are loaded on demand.
const PdfViewer = lazy(() => import("./PdfViewer").then((m) => ({ default: m.PdfViewer })));
const SpreadsheetViewer = lazy(() => import("./SpreadsheetViewer").then((m) => ({ default: m.SpreadsheetViewer })));
const CodeEditor = lazy(() => import("./CodeEditor").then((m) => ({ default: m.CodeEditor })));
const DocViewer = lazy(() => import("./DocViewer").then((m) => ({ default: m.DocViewer })));
const CollaboraViewer = lazy(() =>
  import("./CollaboraViewer").then((m) => ({ default: m.CollaboraViewer }))
);

const WORD_EXTENSIONS = new Set(["doc", "docx"]);

// Grace period after asking Collabora to save before unmounting it (no confirmation is sent back).
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
  // Share permissions for items inside "Shared with me"; null for own items.
  permissions?: InternalSharePermissions | null;
}) {
  const canEdit = !permissions || permissions.can_update;
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const collaboraRef = useRef<CollaboraViewerHandle>(null);
  const [collaboraReady, setCollaboraReady] = useState(false);

  const viewable = siblings.filter((f) => !f.isFolder);
  const index = viewable.findIndex((f) => f.id === item.id);
  const prevItem = index > 0 ? viewable[index - 1] : null;
  const nextItem = index >= 0 && index < viewable.length - 1 ? viewable[index + 1] : null;

  const isCollabora = isCollaboraSupported(item);

  const isOfficeDoc =
    item.type === "pdf" ||
    item.type === "spreadsheet" ||
    (item.type === "document" && !!item.extension && WORD_EXTENSIONS.has(item.extension)) ||
    isCollabora;

  useEffect(() => {
    setCollaboraReady(false);
  }, [item.id]);

  const canToggleExpand = !isOfficeDoc && item.type !== "video" && item.type !== "audio";
  const isFullView = isOfficeDoc || (canToggleExpand && isExpanded);

  // Ask Collabora to save, wait the grace period, then run `action`.
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
      // Via handleClose so a backdrop click also saves Collabora edits.
      handleClose();
    }
  };

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
      } else if (!isMinimized && !isCollabora && e.key === "ArrowLeft" && prevItem) {
        navigateTo(prevItem);
      } else if (!isMinimized && !isCollabora && e.key === "ArrowRight" && nextItem) {
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
            onNativeClose={handleClose}
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

  // Collabora shows its own title and ribbon, so it gets no header bar.
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
          {/* No prev/next: switching files mid-edit should be deliberate. */}
          <div className="absolute inset-0 flex flex-col overflow-hidden bg-bg-main">
            {/* Collabora's ribbon is the only chrome; just an "Open in new tab" button. */}
            <div className="relative flex-1 min-h-0 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {renderContent()}
              <button
                onClick={() => collaboraRef.current?.openInNewTab()}
                disabled={!collaboraReady}
                title={collaboraReady ? "Open in a new tab (use this if the editor stays blank)" : "Waiting for the editor session…"}
                className="absolute bottom-4 right-4 z-20 border-none bg-black/40 hover:bg-black/60 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm p-2.5 rounded-full text-white cursor-pointer flex items-center justify-center transition shadow-lg"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
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
