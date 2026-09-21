import { useState } from "react";
import type { ReactNode } from "react";
import { Loader2, MoreVertical } from "lucide-react";
import type { FileItem, GridSize } from "../../types/file";
import { formatBytes, formatDate, isItemProcessing } from "../../utils/format";
import { getItemIcon } from "./FileIcon";
import { ContextMenuPortal } from "../common/ContextMenuPortal";
import type { AnchorRect } from "../common/ContextMenuPortal";

// Windows Explorer-style icon size presets for grid view — column count, icon size
// and text scale all move together per size. No card border/shadow by default (see
// renderCard below) — just a big icon, a name underneath, and a flat highlight on
// hover/selection, the way Explorer's icon views look rather than a bordered card grid.
const GRID_SIZE_CONFIG: Record<
  GridSize,
  { cols: string; gap: string; thumbHeight: string; iconSize: string; padding: string; nameSize: string }
> = {
  small: {
    cols: "grid-cols-[repeat(auto-fill,minmax(72px,1fr))]",
    gap: "gap-1",
    thumbHeight: "h-10",
    iconSize: "w-8 h-8",
    padding: "p-2",
    nameSize: "text-[11px]",
  },
  medium: {
    cols: "grid-cols-[repeat(auto-fill,minmax(100px,1fr))]",
    gap: "gap-2",
    thumbHeight: "h-16",
    iconSize: "w-14 h-14",
    padding: "p-3",
    nameSize: "text-xs",
  },
  large: {
    cols: "grid-cols-[repeat(auto-fill,minmax(140px,1fr))]",
    gap: "gap-3",
    thumbHeight: "h-24",
    iconSize: "w-20 h-20",
    padding: "p-4",
    nameSize: "text-sm",
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
  return <div className={`flex items-center justify-center ${config.thumbHeight}`}>{getItemIcon(item, config.iconSize)}</div>;
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
        className={`group relative hover:z-20 rounded-lg ${config.padding} cursor-pointer flex flex-col items-center gap-1.5 transition-colors duration-150 ${
          isSel ? "bg-accent-bg/70!" : isChecked ? "bg-accent-bg/70!" : "hover:bg-code-bg"
        } ${isDragOver ? "outline-2 outline-accent -outline-offset-2" : ""}`}
      >
        <div className="absolute top-1 left-1 right-1 flex items-center justify-between z-10">
          <input
            type="checkbox"
            checked={isChecked}
            onClick={(e) => e.stopPropagation()}
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
              className="row-actions-trigger opacity-0 group-hover:opacity-100 focus:opacity-100 border-none bg-transparent p-1 rounded-full text-text-main hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-text-heading cursor-pointer inline-flex items-center justify-center transition"
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

        <div className="relative">
          <Thumbnail item={item} config={config} />
          {!item.isFolder && isItemProcessing(item) && (
            <span
              title="Processing"
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-bg-main border border-border-main flex items-center justify-center"
            >
              <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-500" />
            </span>
          )}
        </div>

        <span className={`${config.nameSize} font-medium text-text-heading text-center line-clamp-2 break-words w-full px-0.5`}>
          {item.name}
        </span>

        {/* Explorer-style hover details — grid tiles drop the metadata line for the
            icon-only look, so this is the only place size/date/owner show. */}
        <div className="hidden group-hover:flex absolute z-30 top-full left-1/2 -translate-x-1/2 mt-1 w-52 flex-col gap-1 bg-bg-main border border-border-main rounded-lg shadow-lg p-2.5 text-[11px] text-left pointer-events-none">
          <span className="font-semibold text-text-heading break-words">{item.name}</span>
          <span className="text-text-main">
            {item.isFolder ? "Folder" : item.extension ? `${item.extension.toUpperCase()} file` : "File"}
          </span>
          <span className="text-text-main">
            {item.isFolder
              ? item.size > 0
                ? formatBytes(item.size)
                : "Empty"
              : isItemProcessing(item)
                ? "Processing…"
                : formatBytes(item.size)}
          </span>
          <span className="text-text-main">Modified {formatDate(item.modifiedAt)}</span>
          {item.owner?.name && <span className="text-text-main">Owner: {item.owner.name}</span>}
          {item.createdBy && <span className="text-text-main">Created by: {item.createdBy}</span>}
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
