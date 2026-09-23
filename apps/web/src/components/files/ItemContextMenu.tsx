import { useState } from "react";
import { Download, FolderOpen, RotateCcw, Trash2, XCircle, FolderInput, CopyPlus, Pencil, History, Share2, Palette, Check, Lock, Link2 } from "lucide-react";
import type { FileItem, InternalSharePermissions } from "../../types/file";
import { isItemFailed, isItemProcessing, isItemLocked } from "../../utils/format";
import { FOLDER_COLORS, FOLDER_ICONS } from "./FileIcon";

export function ItemContextMenu({
  item,
  permissions = null,
  onOpen,
  onDownload,
  onRename,
  onMove,
  onCopy,
  onVersionHistory,
  onShare,
  onCopyLink,
  onSetColor,
  onSetIcon,
  onTrash,
  onRestore,
  onPermanentDelete,
  className = "",
}: {
  item: FileItem;
  // The caller's permissions when `item` lives in a "Shared with me" subtree; null
  // for the user's own items (full control).
  permissions?: InternalSharePermissions | null;
  // Folders only — opens the folder (same as double-click).
  onOpen?: () => void;
  onDownload: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onVersionHistory: () => void;
  onShare: () => void;
  // Copies a link that opens this item for people who already have access.
  onCopyLink?: () => void;
  onSetColor: (color: string | null) => void;
  onSetIcon: (icon: string | null) => void;
  onTrash: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
  className?: string;
}) {
  const [customizing, setCustomizing] = useState(false);

  const itemClass =
    "flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-main";
  const destructiveClass =
    "flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-red-500 rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-red-500/10 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-red-500";

  const effectivePermissions = permissions ?? item.sharedIn?.permissions ?? null;
  const locked = isItemLocked(item);

  // In a shared subtree, only offer what the share grants. Own items: everything.
  const shared = effectivePermissions !== null;
  const allowDownload = !shared || effectivePermissions.can_download;
  const allowEdit = !shared || effectivePermissions.can_update; // rename, colour/icon, star
  const allowMove = !shared || (effectivePermissions.can_update && effectivePermissions.can_create);
  // Move to Trash is client-only (see fileSystemStore.ts trashItems) — deliberately not
  // offered for shared items regardless of permission, since trash is scoped to the
  // owner's own drive. Permanent delete hits a real backend endpoint though, so it's
  // allowed for shared items when the share grants can_delete.
  const allowTrash = !shared && !item.isDeleted;
  const allowPermanentDelete = (!shared || effectivePermissions.can_delete) && !item.isDeleted;
  const allowShare = !shared; // can't re-share someone else's folder

  const canCustomize = item.isFolder && !item.isDeleted && allowEdit;

  return (
    <div className={`context-dropdown z-50 w-52 bg-bg-main border border-border-main rounded-xl p-1 shadow-md flex flex-col gap-0.5 animate-scale-in ${className}`}>
      {locked && (
        <div className="px-3 py-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg flex items-center gap-1.5 border border-amber-500/20 mb-0.5">
          <Lock className="w-3 h-3 text-amber-500" /> File is locked
        </div>
      )}
      {item.isFolder && onOpen && (
        <button onClick={onOpen} className={itemClass}>
          <FolderOpen className="w-3.5 h-3.5" /> Open
        </button>
      )}
      {allowDownload && (
        <button
          onClick={onDownload}
          disabled={isItemProcessing(item) || isItemFailed(item)}
          title={isItemFailed(item) ? "File failed to process" : isItemProcessing(item) ? "File is still processing" : undefined}
          className={`${itemClass} ${isItemProcessing(item) || isItemFailed(item) ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <Download className="w-3.5 h-3.5" /> {item.isFolder ? "Download as .zip" : "Download"}
        </button>
      )}
      {allowEdit && (
        <button
          onClick={onRename}
          disabled={locked}
          title={locked ? "File is locked and cannot be renamed" : undefined}
          className={itemClass}
        >
          <Pencil className="w-3.5 h-3.5" /> Rename
        </button>
      )}
      {!item.isFolder && (
        <button
          onClick={onVersionHistory}
          disabled={locked}
          title={locked ? "File is locked" : undefined}
          className={itemClass}
        >
          <History className="w-3.5 h-3.5" /> Version History
        </button>
      )}
      {!item.isDeleted && (
        <>
          {allowMove && (
            <button
              onClick={onMove}
              disabled={locked}
              title={locked ? "File is locked and cannot be moved" : undefined}
              className={itemClass}
            >
              <FolderInput className="w-3.5 h-3.5" /> Move to…
            </button>
          )}
          {!item.isFolder && (
            <button
              onClick={onCopy}
              disabled={locked}
              title={locked ? "File is locked and cannot be copied" : undefined}
              className={itemClass}
            >
              <CopyPlus className="w-3.5 h-3.5" /> Copy to…
            </button>
          )}
          {allowShare && (
            <button onClick={onShare} className={itemClass}>
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          )}
          {onCopyLink && (
            <button onClick={onCopyLink} className={itemClass}>
              <Link2 className="w-3.5 h-3.5" /> Copy link
            </button>
          )}
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
          <button
            onClick={onRestore}
            disabled={locked}
            title={locked ? "File is locked" : undefined}
            className={itemClass}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restore
          </button>
          <button
            onClick={onPermanentDelete}
            disabled={locked}
            title={locked ? "File is locked" : undefined}
            className={destructiveClass}
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
          </button>
        </>
      ) : (
        <>
          {allowTrash && (
            <button
              onClick={onTrash}
              disabled={locked}
              title={locked ? "File is locked and cannot be moved to trash" : undefined}
              className={destructiveClass}
            >
              <Trash2 className="w-3.5 h-3.5" /> Move to Trash
            </button>
          )}
          {allowPermanentDelete && (
            // Skips Trash entirely — DELETE /files/delete/file or /folders/delete
            // straight away, same confirm dialog as the Trash-tab version above. A
            // different icon from "Move to Trash" so two destructive actions in a
            // row don't read as duplicates of each other.
            <button
              onClick={onPermanentDelete}
              disabled={locked}
              title={locked ? "File is locked and cannot be deleted" : undefined}
              className={destructiveClass}
            >
              <XCircle className="w-3.5 h-3.5" /> Delete Permanently
            </button>
          )}
        </>
      )}
    </div>
  );
}
