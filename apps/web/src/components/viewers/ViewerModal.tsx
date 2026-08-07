import { Suspense, lazy, useEffect } from "react";
import { ChevronLeft, ChevronRight, Download, File as FileIcon, X } from "lucide-react";
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
  const viewable = siblings.filter((f) => !f.isFolder);
  const index = viewable.findIndex((f) => f.id === item.id);
  const prevItem = index > 0 ? viewable[index - 1] : null;
  const nextItem = index >= 0 && index < viewable.length - 1 ? viewable[index + 1] : null;

  // Office-suite documents (PDF/Word/Excel) get a near-fullscreen viewport instead of the
  // narrower default box, since they're read as full pages rather than a quick preview.
  const isOfficeDoc = item.type === "pdf" || item.type === "spreadsheet" || (item.type === "document" && !!item.extension && WORD_EXTENSIONS.has(item.extension));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && prevItem) onNavigate(prevItem);
      else if (e.key === "ArrowRight" && nextItem) onNavigate(nextItem);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNavigate, prevItem, nextItem]);

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
    if (item.type === "video" || item.type === "audio") return <MediaPlayer item={item} size="full" />;
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
    <div className="fixed inset-0 z-[1500] bg-black/60 backdrop-blur-sm flex flex-col animate-fade-in" onClick={onClose}>
      <div className="flex items-center justify-between px-6 py-4 text-white shrink-0" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm font-semibold truncate max-w-[60vw]">{item.name}</span>
        <div className="flex items-center gap-2">
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
            onClick={onClose}
            className="border-none bg-white/10 hover:bg-white/20 p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center gap-4 px-4 pb-6 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => prevItem && onNavigate(prevItem)}
          disabled={!prevItem}
          className="border-none bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div
          className={`bg-bg-main rounded-2xl shadow-lg flex flex-col overflow-hidden ${
            isOfficeDoc ? "w-[97%] h-[95%]" : "w-full max-w-3xl max-h-full"
          }`}
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-6">{renderContent()}</div>
        </div>

        <button
          onClick={() => nextItem && onNavigate(nextItem)}
          disabled={!nextItem}
          className="border-none bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed p-2 rounded-full text-white cursor-pointer flex items-center justify-center transition shrink-0"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
