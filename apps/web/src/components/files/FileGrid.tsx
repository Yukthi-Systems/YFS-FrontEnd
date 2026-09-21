import { useState } from "react";
import type { ReactNode } from "react";
import { Loader2, MoreVertical } from "lucide-react";
import type { FileItem, GridSize } from "../../types/file";
import { formatBytes, formatDate, isItemProcessing } from "../../utils/format";
import { getItemIcon } from "./FileIcon";
import { ContextMenuPortal } from "../common/ContextMenuPortal";
import type { AnchorRect } from "../common/ContextMenuPortal";

// Windows-style icon size presets for grid view — column count, thumbnail height and
// icon/text scale all move together per size.
const GRID_SIZE_CONFIG: Record<
  GridSize,
  { cols: string; gap: string; thumbHeight: string; iconSize: string; padding: string; nameSize: string; metaSize: string; showModified: boolean }
> = {
  small: {
    cols: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
    gap: "gap-2",
    thumbHeight: "h-12",
    iconSize: "w-5 h-5",
    padding: "p-2",
    nameSize: "text-[11px]",
    metaSize: "text-[9px]",
    showModified: false,
  },
  medium: {
    cols: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
    gap: "gap-3",
    thumbHeight: "h-20",
    iconSize: "w-8 h-8",
    padding: "p-3",
    nameSize: "text-xs",
    metaSize: "text-[10px]",
    showModified: false,
  },
  large: {
    cols: "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    gap: "gap-4",
    thumbHeight: "h-40",
    iconSize: "w-12 h-12",
    padding: "p-4",
    nameSize: "text-sm",
    metaSize: "text-[11px]",
    showModified: true,
  },
};

function Thumbnail({ item, config }: { item: FileItem; config: (typeof GRID_SIZE_CONFIG)[GridSize] }) {
  if (item.type === "image" && item.blobUrl) {
    return (
      <div className={`w-full ${config.thumbHeight} rounded-lg overflow-hidden bg-code-bg flex items-center justify-center`}>
        <img src={item.blobUrl} alt={item.name} className="w-full h-full object-cover" />
      </div>
    );
  }
  if (item.type === "video" && item.blobUrl) {
    return (
      <div className={`w-full ${config.thumbHeight} rounded-lg overflow-hidden bg-code-bg flex items-center justify-center`}>
        <video src={item.blobUrl} className="w-full h-full object-cover" muted />
      </div>
    );
  }
  return <div className="flex justify-center py-2">{getItemIcon(item, config.iconSize)}</div>;
}

export function FileGrid({
  items,
  gridSize = "medium",
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
  gridSize?: GridSize;
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
  const config = GRID_SIZE_CONFIG[gridSize];

  const renderCard = (item: FileItem) => {
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
        className={`group relative bg-bg-main border border-border-main rounded-xl ${config.padding} cursor-pointer flex flex-col gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-sm ${
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

        <Thumbnail item={item} config={config} />

        <div className="flex flex-col gap-0.5 text-center mt-2">
          <span className={`${config.nameSize} font-semibold text-text-heading truncate w-full px-1`}>{item.name}</span>
          <span className={`${config.metaSize} text-text-main`}>
            {item.isFolder ? (
              item.size > 0 ? formatBytes(item.size) : "Folder"
            ) : isItemProcessing(item) ? (
              <span className="inline-flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-500" />
                Processing
              </span>
            ) : (
              formatBytes(item.size)
            )}
          </span>
          {config.showModified && <span className={`${config.metaSize} text-text-main`}>{formatDate(item.modifiedAt)}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className={`grid ${config.cols} ${config.gap}`} onClick={(e) => e.stopPropagation()}>
      {items.map(renderCard)}
    </div>
  );
}
