import { Download, Star, RotateCcw, Trash2, FolderInput, CopyPlus, Pencil, History, Share2 } from "lucide-react";
import type { FileItem } from "../../types/file";

export function ItemContextMenu({
  item,
  onDownload,
  onToggleStar,
  onRename,
  onMove,
  onCopy,
  onVersionHistory,
  onShare,
  onTrash,
  onRestore,
  onPermanentDelete,
  className = "",
}: {
  item: FileItem;
  onDownload: () => void;
  onToggleStar: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onVersionHistory: () => void;
  onShare: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
  className?: string;
}) {
  const itemClass =
    "flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition";
  const destructiveClass =
    "flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-red-500 rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-red-500/10 transition";

  return (
    <div className={`context-dropdown z-50 w-44 bg-bg-main border border-border-main rounded-xl p-1 shadow-md flex flex-col gap-0.5 animate-scale-in ${className}`}>
      <button onClick={onDownload} className={itemClass}>
        <Download className="w-3.5 h-3.5" /> {item.isFolder ? "Download as .zip" : "Download"}
      </button>
      <button onClick={onToggleStar} className={itemClass}>
        <Star className={`w-3.5 h-3.5 ${item.isStarred ? "text-yellow-400 fill-yellow-400" : ""}`} />{" "}
        {item.isStarred ? "Unstar" : "Star"}
      </button>
      <button onClick={onRename} className={itemClass}>
        <Pencil className="w-3.5 h-3.5" /> Rename
      </button>
      {!item.isFolder && (
        <button onClick={onVersionHistory} className={itemClass}>
          <History className="w-3.5 h-3.5" /> Version History
        </button>
      )}
      {!item.isDeleted && (
        <>
          <button onClick={onMove} className={itemClass}>
            <FolderInput className="w-3.5 h-3.5" /> Move to…
          </button>
          <button onClick={onCopy} className={itemClass}>
            <CopyPlus className="w-3.5 h-3.5" /> Copy to…
          </button>
          <button onClick={onShare} className={itemClass}>
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </>
      )}
      {item.isDeleted ? (
        <>
          <button onClick={onRestore} className={itemClass}>
            <RotateCcw className="w-3.5 h-3.5" /> Restore
          </button>
          <button onClick={onPermanentDelete} className={destructiveClass}>
            <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
          </button>
        </>
      ) : (
        <button onClick={onTrash} className={destructiveClass}>
          <Trash2 className="w-3.5 h-3.5" /> Move to Trash
        </button>
      )}
    </div>
  );
}
