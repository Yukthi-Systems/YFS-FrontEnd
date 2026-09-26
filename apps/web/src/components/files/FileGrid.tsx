/*
 * Copyright (C) 2026 Yukthi Systems Private Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * version 3 along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, Loader2, MoreVertical, Lock } from "lucide-react";
import type { ItemPressHandlers } from "../../hooks/useFileSelection";
import type { FileItem, GridSize } from "../../types/file";
import { formatBytes, formatDate, getOwnerDisplay, isItemFailed, isItemProcessing, isItemLocked } from "../../utils/format";
import type { UserInfo } from "../../atoms/auth";
import { useAuth } from "../../hooks/useAuth";
import { getItemIcon } from "./FileIcon";
import { Checkbox } from "../common/Checkbox";
import { ContextMenuPortal } from "../common/ContextMenuPortal";
import type { AnchorRect } from "../common/ContextMenuPortal";

// Grid tiles drop the metadata line for the icon-only look, so size/date/owner live in the native tooltip.
const hoverDetails = (item: FileItem, me: UserInfo | null) => {
  const kind = item.isFolder ? "Folder" : item.extension ? `${item.extension.toUpperCase()} file` : "File";
  const size = item.isFolder
    ? item.size > 0
      ? formatBytes(item.size)
      : "Empty"
    : isItemFailed(item)
      ? "Failed to process"
      : isItemProcessing(item)
        ? "Processing…"
        : formatBytes(item.size);
  const owner = getOwnerDisplay(item, me).label;
  return [item.name, `${kind} · ${size}`, `Modified ${formatDate(item.modifiedAt)}`, owner && `Owner: ${owner}`]
    .filter(Boolean)
    .join("\n");
};

// Explorer-style icon sizes: columns, icon and text scale together.
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
  getItemPressHandlers,
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
  getItemPressHandlers?: (item: FileItem) => ItemPressHandlers;
}) {
  const [menuAnchor, setMenuAnchor] = useState<{ rect: AnchorRect; align: "start" | "end" } | null>(null);
  const { user } = useAuth();
  const config = GRID_SIZE_CONFIG[gridSize];

  const renderCard = (item: FileItem) => {
    const isSel = selectedItemId === item.id;
    const isChecked = checkedItemIds.includes(item.id);
    const selecting = checkedItemIds.length > 0;
    const isDragOver = item.isFolder && dragOverFolderId === item.id;
    const locked = isItemLocked(item);
    return (
      <div
        key={item.id}
        data-item-id={item.id}
        draggable={!locked && !isItemProcessing(item)}
        onDragStart={(e) => onDragStartItem(item, e)}
        onDragOver={(e) => item.isFolder && onDragOverFolder(item, e)}
        onDragLeave={() => item.isFolder && onDragLeaveFolder(item)}
        onDrop={(e) => item.isFolder && onDropOnFolder(item, e)}
        onClick={(e) => onItemClick(item, e)}
        {...getItemPressHandlers?.(item)}
        onContextMenu={(e) => {
          setMenuAnchor({ rect: { top: e.clientY, left: e.clientX, right: e.clientX, bottom: e.clientY }, align: "start" });
          onItemContextMenu(item, e);
        }}
        title={hoverDetails(item, user)}
        className={`group relative select-none [-webkit-touch-callout:none] rounded-lg ${config.padding} cursor-pointer flex flex-col items-center gap-1.5 transition-colors duration-150 ${
          isSel ? "bg-accent-bg/70!" : isChecked ? "bg-accent-bg/70!" : "hover:bg-code-bg"
        } ${isDragOver ? "outline-2 outline-accent -outline-offset-2" : ""}`}
      >
        <div className="absolute top-1 left-1 right-1 flex items-center justify-between z-10">
          <Checkbox
            checked={isChecked}
            onClick={(e) => e.stopPropagation()}
            onChange={(_, e) => onCheckboxToggle(item.id, e as unknown as React.MouseEvent)}
            ariaLabel={`Select ${item.name}`}
            className={`opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 max-[768px]:invisible ${isChecked || selecting ? "opacity-100!" : ""}`}
          />
          <div className="relative">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const opening = contextMenuId !== item.id;
                setMenuAnchor(opening ? { rect: e.currentTarget.getBoundingClientRect(), align: "end" } : null);
                onContextMenuToggle(opening ? item.id : null);
              }}
              className="row-actions-trigger opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 border-none bg-transparent p-1 rounded-full text-text-main hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-text-heading cursor-pointer inline-flex items-center justify-center transition"
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
          {!item.isFolder && isItemFailed(item) && (
            <span
              title="Failed"
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-bg-main border border-border-main flex items-center justify-center"
            >
              <AlertCircle className="w-2.5 h-2.5 text-red-500" />
            </span>
          )}
          {!item.isFolder && !isItemFailed(item) && locked && (
            <span
              title="Locked"
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-bg-main border border-amber-500/30 flex items-center justify-center shadow-xs"
            >
              <Lock className="w-2.5 h-2.5 text-amber-500" />
            </span>
          )}
          {!item.isFolder && !isItemFailed(item) && !locked && isItemProcessing(item) && (
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

      </div>
    );
  };

  return (
    <div className={`grid ${config.cols} ${config.gap}`} onClick={(e) => e.stopPropagation()}>
      {items.map(renderCard)}
    </div>
  );
}
