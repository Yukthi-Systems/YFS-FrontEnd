import { useState } from "react";
import type { ReactNode } from "react";
import { Loader2, MoreVertical } from "lucide-react";
import type { FileItem } from "../../types/file";
import { formatBytes, formatDate, isItemProcessing } from "../../utils/format";
import { getItemIcon } from "./FileIcon";
import { ContextMenuPortal } from "../common/ContextMenuPortal";
import type { AnchorRect } from "../common/ContextMenuPortal";

// Windows "Tiles" style: icon on the left, name + metadata stacked to the right,
// wide cards in a 1-3 column grid — denser than large-icon grid, richer than the
// plain list rows.
export function FileTiles({
  items,
  selectedItemId,
  checkedItemIds,
  contextMenuId,
  dragOverFolderId,
  onItemClick,
  onCheckboxToggle,
  onContextMenuToggle,
  onItemContextMenu,
  renderContextMenu,
  onDragStartItem,
  onDragOverFolder,
  onDragLeaveFolder,
  onDropOnFolder,
}: {
  items: FileItem[];
  selectedItemId: string | null;
  checkedItemIds: string[];
  contextMenuId: string | null;
  dragOverFolderId: string | null;
  onItemClick: (item: FileItem, e: React.MouseEvent) => void;
  onCheckboxToggle: (id: string, e: React.MouseEvent) => void;
  onContextMenuToggle: (id: string | null) => void;
  onItemContextMenu: (item: FileItem, e: React.MouseEvent) => void;
  renderContextMenu: (item: FileItem) => ReactNode;
  onDragStartItem: (item: FileItem, e: React.DragEvent) => void;
  onDragOverFolder: (item: FileItem, e: React.DragEvent) => void;
  onDragLeaveFolder: (item: FileItem) => void;
  onDropOnFolder: (item: FileItem, e: React.DragEvent) => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<{ rect: AnchorRect; align: "start" | "end" } | null>(null);

  const renderTile = (item: FileItem) => {
    const isSel = selectedItemId === item.id;
    const isChecked = checkedItemIds.includes(item.id);
    const isDragOver = item.isFolder && dragOverFolderId === item.id;
    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => onDragStartItem(item, e)}
        onDragOver={(e) => item.isFolder && onDragOverFolder(item, e)}
        onDragLeave={() => item.isFolder && onDragLeaveFolder(item)}
        onDrop={(e) => item.isFolder && onDropOnFolder(item, e)}
        onClick={(e) => onItemClick(item, e)}
        onContextMenu={(e) => {
          setMenuAnchor({ rect: { top: e.clientY, left: e.clientX, right: e.clientX, bottom: e.clientY }, align: "start" });
          onItemContextMenu(item, e);
        }}
        className={`group relative bg-bg-main border border-border-main rounded-xl p-3 cursor-pointer flex items-center gap-3 transition-all duration-200 hover:border-accent-border hover:shadow-sm ${
          isSel ? "bg-accent-bg! border-accent!" : ""
        } ${isDragOver ? "outline-2 outline-accent -outline-offset-2" : ""}`}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onCheckboxToggle(item.id, e as unknown as React.MouseEvent)}
          className={`shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 ${isChecked ? "opacity-100!" : ""}`}
        />

        <div className="shrink-0 w-10 h-10 rounded-lg bg-code-bg flex items-center justify-center overflow-hidden">
          {item.type === "image" && item.blobUrl ? (
            <img src={item.blobUrl} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            getItemIcon(item, "w-6 h-6")
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text-heading truncate">{item.name}</div>
          <div className="text-[11px] text-text-main truncate">
            {isItemProcessing(item) ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-500" />
                Processing
              </span>
            ) : (
              <>
                {item.isFolder ? (item.size > 0 ? formatBytes(item.size) : "Folder") : formatBytes(item.size)}
                {" · "}
                {formatDate(item.modifiedAt)}
              </>
            )}
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            onClick={(e) => {
              const opening = contextMenuId !== item.id;
              setMenuAnchor(opening ? { rect: e.currentTarget.getBoundingClientRect(), align: "end" } : null);
              onContextMenuToggle(opening ? item.id : null);
            }}
            className="row-actions-trigger border-none bg-transparent p-1 rounded-full text-text-main hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-text-heading cursor-pointer inline-flex items-center justify-center transition"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {contextMenuId === item.id && menuAnchor && (
            <ContextMenuPortal anchor={menuAnchor.rect} align={menuAnchor.align}>
              {renderContextMenu(item)}
            </ContextMenuPortal>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" onClick={(e) => e.stopPropagation()}>
      {items.map(renderTile)}
    </div>
  );
}
