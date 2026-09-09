import { useState } from "react";
import { Download, Star, RotateCcw, Trash2, FolderInput, CopyPlus, Pencil, History, Share2, Palette, Check } from "lucide-react";
import type { FileItem } from "../../types/file";
import { FOLDER_COLORS, FOLDER_ICONS } from "./FileIcon";

export function ItemContextMenu({
  item,
  onDownload,
  onToggleStar,
  onRename,
  onMove,
  onCopy,
  onVersionHistory,
  onShare,
  onSetColor,
  onSetIcon,
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
  onSetColor: (color: string | null) => void;
  onSetIcon: (icon: string | null) => void;
  onTrash: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
  className?: string;
}) {
  const [customizing, setCustomizing] = useState(false);

  const itemClass =
    "flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition";
  const destructiveClass =
    "flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-red-500 rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-red-500/10 transition";

  const canCustomize = item.isFolder && !item.isDeleted;

  return (
    <div className={`context-dropdown z-50 w-52 bg-bg-main border border-border-main rounded-xl p-1 shadow-md flex flex-col gap-0.5 animate-scale-in ${className}`}>
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
          {!item.isFolder && (
            <button onClick={onCopy} className={itemClass}>
              <CopyPlus className="w-3.5 h-3.5" /> Copy to…
            </button>
          )}
          <button onClick={onShare} className={itemClass}>
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </>
      )}

      {canCustomize && (
        <>
          <button onClick={() => setCustomizing((v) => !v)} className={itemClass}>
            <Palette className="w-3.5 h-3.5" /> Colour &amp; icon
          </button>
          {customizing && (
            <div className="px-2 py-1.5 flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => onSetColor(null)}
                  title="Default colour"
                  className="w-5 h-5 rounded-full border border-border-main bg-bg-main flex items-center justify-center text-text-main"
                >
                  {!item.color && <Check className="w-3 h-3" />}
                </button>
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => onSetColor(c)}
                    title={c}
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: c }}
                  >
                    {item.color === c && <Check className="w-3 h-3 text-white" />}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {FOLDER_ICONS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => onSetIcon(key === "folder" ? null : key)}
                    title={label}
                    className={`w-6 h-6 rounded-md flex items-center justify-center border ${
                      (item.icon ?? "folder") === key ? "border-accent bg-accent-bg" : "border-transparent hover:bg-code-bg"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" style={item.color ? { color: item.color } : undefined} />
                  </button>
                ))}
              </div>
            </div>
          )}
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
