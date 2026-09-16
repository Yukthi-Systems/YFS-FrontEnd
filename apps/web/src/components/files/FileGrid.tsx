import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, MoreVertical } from "lucide-react";
import type { FileItem } from "../../types/file";
import { formatBytes, isItemProcessing } from "../../utils/format";
import { getItemIcon } from "./FileIcon";
import { ContextMenuPortal } from "../common/ContextMenuPortal";
import type { AnchorRect } from "../common/ContextMenuPortal";
import { useScrollMargin } from "../../hooks/useScrollMargin";
import { useGridColumns } from "../../hooks/useGridColumns";

const GRID_COLS_CLASS = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

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
  return <div className="flex justify-center py-2">{getItemIcon(item, "w-8 h-8")}</div>;
}

export function FileGrid({
  items,
  scrollElement,
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
  // The scrollable ancestor this grid renders inside — a folder can hold thousands
  // of files, so only visible rows of cards are mounted at once.
  scrollElement: HTMLElement | null;
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
  const { ref: marginRef, margin: scrollMargin } = useScrollMargin<HTMLDivElement>(scrollElement);
  const columns = useGridColumns();

  const rows = useMemo(() => {
    const out: FileItem[][] = [];
    for (let i = 0; i < items.length; i += columns) out.push(items.slice(i, i + columns));
    return out;
  }, [items, columns]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 168,
    overscan: 4,
    scrollMargin,
  });

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
        className={`group relative bg-bg-main border border-border-main rounded-xl p-3 cursor-pointer flex flex-col gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-sm ${
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
          <span className="text-[10px] text-text-main">
            {item.isFolder ? (
              "Directory"
            ) : isItemProcessing(item) ? (
              <span className="inline-flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-500" />
                Processing
              </span>
            ) : (
              formatBytes(item.size)
            )}
          </span>
        </div>
      </div>
    );
  };

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start - scrollMargin : 0;
  const paddingBottom = virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div ref={marginRef} className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
      {paddingTop > 0 && <div style={{ height: paddingTop }} />}
      {virtualRows.map((virtualRow) => (
        <div
          key={virtualRow.key}
          data-index={virtualRow.index}
          ref={rowVirtualizer.measureElement}
          className={`grid ${GRID_COLS_CLASS} gap-3`}
        >
          {rows[virtualRow.index].map(renderCard)}
        </div>
      ))}
      {paddingBottom > 0 && <div style={{ height: paddingBottom }} />}
    </div>
  );
}
