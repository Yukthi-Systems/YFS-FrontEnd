import { useState } from "react";
import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import type { FileItem } from "../../types/file";
import { formatBytes } from "../../utils/format";
import { getFileIcon } from "./FileIcon";
import { ContextMenuPortal } from "../common/ContextMenuPortal";
import type { AnchorRect } from "../common/ContextMenuPortal";

function Thumbnail({ item }: { item: FileItem }) {
  if (item.type === "image" && item.blobUrl) {
    return (
      <div className="w-full h-20 rounded-lg overflow-hidden bg-code-bg flex items-center justify-center">
        <img src={item.blobUrl} alt={item.name} className="w-full h-full object-cover" />
      </div>
    );
  }
  if (item.type === "video" && item.blobUrl) {
    return (
      <div className="w-full h-20 rounded-lg overflow-hidden bg-code-bg flex items-center justify-center">
        <video src={item.blobUrl} className="w-full h-full object-cover" muted />
      </div>
    );
  }
  return <div className="flex justify-center py-2">{getFileIcon(item.type, "w-9 h-9")}</div>;
}

export function FileGrid({
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5" onClick={(e) => e.stopPropagation()}>
      {items.map((item) => {
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
            className={`group relative bg-bg-main border border-border-main rounded-2xl p-4 cursor-pointer flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-sm ${
              isSel ? "bg-accent-bg! border-accent!" : ""
            } ${isDragOver ? "outline-2 outline-accent -outline-offset-2" : ""}`}
          >
            <div className="flex items-center justify-between">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => onCheckboxToggle(item.id, e as unknown as React.MouseEvent)}
                className={`opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 ${isChecked ? "opacity-100!" : ""}`}
              />
              <div className="relative">
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

            <Thumbnail item={item} />

            <div className="flex flex-col gap-0.5 text-center mt-2">
              <span className="text-xs font-semibold text-text-heading truncate w-full px-1">{item.name}</span>
              <span className="text-[10px] text-text-main">{item.isFolder ? "Directory" : formatBytes(item.size)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
