import { Download, Expand, FolderInput, CopyPlus, Star, Trash2, X, History, Share2 } from "lucide-react";
import type { FileItem } from "../../types/file";
import { formatBytes, formatDate } from "../../utils/format";
import { getFileIcon } from "./FileIcon";
import { MediaPlayer } from "../viewers/MediaPlayer";

const PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='1'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

function CompactPreview({ item }: { item: FileItem }) {
  if (item.isFolder) {
    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main">
        {getFileIcon("folder", "w-12 h-12")}
        <div className="text-xs font-medium">Folder containing directory contents</div>
      </div>
    );
  }

  if (item.type === "image") {
    return (
      <img
        src={item.blobUrl || PLACEHOLDER_SVG}
        alt={item.name}
        className="max-w-full max-h-[160px] object-contain rounded-lg shadow-sm"
      />
    );
  }

  if (item.type === "audio" || item.type === "video") {
    return <MediaPlayer item={item} size="compact" />;
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center text-text-main">
      {getFileIcon(item.type, "w-12 h-12")}
      <div className="text-xs font-medium">{item.extension?.toUpperCase() || "Unknown"} file — click Open to view</div>
    </div>
  );
}

export function DetailsDrawer({
  item,
  pathLabel,
  onClose,
  onOpenFull,
  onDownload,
  onToggleStar,
  onRename,
  onMove,
  onCopy,
  onVersionHistory,
  onShare,
  onTrash,
  onRestore,
}: {
  item: FileItem;
  pathLabel: string;
  onClose: () => void;
  onOpenFull: () => void;
  onDownload: () => void;
  onToggleStar: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onVersionHistory: () => void;
  onShare: () => void;
  onTrash: () => void;
  onRestore: () => void;
}) {
  return (
    <aside
      className="w-90 min-w-[360px] border-l border-border-main bg-bg-main flex flex-col h-full overflow-y-auto box-border shrink-0 max-[1024px]:absolute max-[1024px]:right-0 max-[1024px]:top-0 max-[1024px]:bottom-0 max-[1024px]:z-40 max-[1024px]:shadow-xl max-[420px]:w-full max-[420px]:min-w-0 animate-slide-in-right"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-6 py-4.5 border-b border-border-main flex items-center justify-between">
        <h3 className="text-base font-bold text-text-heading">Details</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-code-bg text-text-main hover:text-text-heading border-none bg-transparent cursor-pointer transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 flex flex-col gap-6 text-left">
        <div
          className="w-full rounded-xl bg-code-bg border border-border-main overflow-hidden flex flex-col items-center justify-center min-h-40 p-4 box-border relative cursor-pointer"
          onClick={() => !item.isFolder && onOpenFull()}
        >
          <CompactPreview item={item} />
          {!item.isFolder && (
            <div className="absolute top-2 right-2 bg-black/40 text-white rounded-full p-1.5">
              <Expand className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-bold text-text-heading break-all leading-snug">{item.name}</h4>
          <span className="text-xs text-text-main">
            Type: {item.isFolder ? "Folder" : item.extension?.toUpperCase() || item.type}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex justify-between text-xs leading-normal">
            <span className="text-text-main font-semibold">Owner</span>
            <span className="text-text-heading font-medium truncate max-w-[60%]">{item.owner.name}</span>
          </div>
          <div className="flex justify-between text-xs leading-normal">
            <span className="text-text-main font-semibold">Location</span>
            <span className="text-text-heading font-medium truncate max-w-[60%]" title={pathLabel}>
              {pathLabel}
            </span>
          </div>
          <div className="flex justify-between text-xs leading-normal">
            <span className="text-text-main font-semibold">Size</span>
            <span className="text-text-heading font-medium">{formatBytes(item.size)}</span>
          </div>
          <div className="flex justify-between text-xs leading-normal">
            <span className="text-text-main font-semibold">Modified</span>
            <span className="text-text-heading font-medium">{formatDate(item.modifiedAt)}</span>
          </div>
          <div className="flex justify-between text-xs leading-normal">
            <span className="text-text-main font-semibold">Created</span>
            <span className="text-text-heading font-medium">{formatDate(item.createdAt)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          {!item.isFolder && (
            <button
              onClick={onOpenFull}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-br from-accent to-purple-600 text-white font-semibold rounded-xl hover:shadow-md cursor-pointer transition-all"
            >
              <Expand className="w-4 h-4" /> Open
            </button>
          )}
          <button
            onClick={onDownload}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs"
          >
            <Download className="w-3.5 h-3.5" /> {item.isFolder ? "Download as .zip" : "Download"}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onToggleStar}
              className="flex-1 py-2.5 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
            >
              <Star className={`w-3.5 h-3.5 ${item.isStarred ? "text-yellow-400 fill-yellow-400" : ""}`} /> {item.isStarred ? "Unstar" : "Star"}
            </button>
            <button
              onClick={onRename}
              className="flex-1 py-2.5 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs"
            >
              Rename
            </button>
          </div>
          {!item.isFolder && (
            <button
              onClick={onVersionHistory}
              className="w-full py-2.5 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" /> Version History
            </button>
          )}
          {!item.isDeleted && (
            <div className="flex gap-2">
              <button
                onClick={onMove}
                className="flex-1 py-2.5 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
              >
                <FolderInput className="w-3.5 h-3.5" /> Move
              </button>
              <button
                onClick={onCopy}
                className="flex-1 py-2.5 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
              >
                <CopyPlus className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
          )}
          {!item.isDeleted && (
            <button
              onClick={onShare}
              className="w-full py-2.5 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          )}
          {item.isDeleted ? (
            <button
              onClick={onRestore}
              className="w-full py-2.5 bg-transparent border border-green-500/50 text-green-600 font-semibold rounded-xl hover:bg-green-500/10 cursor-pointer transition text-xs"
            >
              Restore Item
            </button>
          ) : (
            <button
              onClick={onTrash}
              className="w-full py-2.5 bg-transparent border border-red-500/50 text-red-500 font-semibold rounded-xl hover:bg-red-500/10 cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Move to Trash
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
