import { Suspense, lazy, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  File as FileIcon,
  Maximize2,
  Minimize2,
  Video,
  X,
} from "lucide-react";
import type { FileItem } from "../../types/file";
import { isTextEditable } from "../../utils/fileType";
import { ImageLightbox } from "./ImageLightbox";
import { MediaPlayer } from "./MediaPlayer";

// pdf.js, CodeMirror, and SheetJS are heavy — only pull them into a bundle
// when a file of that type is actually opened.
const PdfViewer = lazy(() => import("./PdfViewer").then((m) => ({ default: m.PdfViewer })));
const SpreadsheetViewer = lazy(() => import("./SpreadsheetViewer").then((m) => ({ default: m.SpreadsheetViewer })));
const CodeEditor = lazy(() => import("./CodeEditor").then((m) => ({ default: m.CodeEditor })));
const DocViewer = lazy(() => import("./DocViewer").then((m) => ({ default: m.DocViewer })));

const WORD_EXTENSIONS = new Set(["doc", "docx"]);

const ViewerLoading = () => <div className="text-sm text-text-main text-center py-16">Loading viewer…</div>;

export function ViewerModal({
  item,
  siblings,
  onClose,
  onNavigate,
  onDownload,
  onSaveContent,
}: {
  item: FileItem;
  siblings: FileItem[];
  onClose: () => void;
  onNavigate: (item: FileItem) => void;
  onDownload: (item: FileItem) => void;
  onSaveContent: (id: string, blob: Blob) => void;
}) {
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const viewable = siblings.filter((f) => !f.isFolder);
  const index = viewable.findIndex((f) => f.id === item.id);
  const prevItem = index > 0 ? viewable[index - 1] : null;
  const nextItem = index >= 0 && index < viewable.length - 1 ? viewable[index + 1] : null;

  // Office-suite documents (PDF/Word/Excel) get a near-fullscreen viewport instead of the
  // narrower default box, since they're read as full pages rather than a quick preview.
  const isOfficeDoc =
    item.type === "pdf" ||
    item.type === "spreadsheet" ||
    (item.type === "document" && !!item.extension && WORD_EXTENSIONS.has(item.extension));

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
    onClose();
  };

  const handleBackdropClick = () => {
    if (isMinimized) return;
    if (isPiPActive) {
      setIsMinimized(true);
    } else {
      onClose();
    }
  };

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
        onNavigate(prevItem);
      } else if (!isMinimized && e.key === "ArrowRight" && nextItem) {
        onNavigate(nextItem);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNavigate, prevItem, nextItem, isPiPActive, isMinimized]);

  const renderContent = () => {
    if (item.type === "image") return <ImageLightbox item={item} />;
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
          <CodeEditor item={item} onSave={(blob) => onSaveContent(item.id, blob)} />
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

  return (
    <div
      className={`fixed z-[1500] transition-all duration-300 ${
        isMinimized
          ? "bottom-6 right-6 w-88 shadow-2xl rounded-2xl bg-neutral-900 border border-white/20 overflow-hidden flex flex-col"
          : "inset-0 bg-black/60 backdrop-blur-sm flex flex-col animate-fade-in"
      }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`flex items-center justify-between text-white shrink-0 ${
          isMinimized ? "px-3.5 py-2.5 bg-neutral-950/90 border-b border-white/10" : "px-6 py-4"
        }`}
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
              {!item.isFolder && (
                <button
                  onClick={() => onDownload(item)}
                  className="border-none bg-white/10 hover:bg-white/20 p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition"
                  title="Download"
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

      <div
        className={`flex-1 flex items-center justify-center overflow-hidden transition-all ${
          isMinimized ? "p-0 h-48 max-h-48" : "gap-4 px-4 pb-6"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {!isMinimized && (
          <button
            onClick={() => prevItem && onNavigate(prevItem)}
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
              : `bg-bg-main rounded-2xl shadow-lg ${
                  isOfficeDoc ? "w-[97%] h-[95%]" : "w-full max-w-3xl max-h-full"
                }`
          }`}
        >
          <div className={`flex-1 min-h-0 overflow-y-auto ${isMinimized ? "p-0" : "p-6"}`}>{renderContent()}</div>
        </div>

        {!isMinimized && (
          <button
            onClick={() => nextItem && onNavigate(nextItem)}
            disabled={!nextItem}
            className="border-none bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
