import { useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, MoreVertical, Lock, UserPlus, Link2 } from "lucide-react";
import type { FileItem, SortField, SortOrder } from "../../types/file";
import { formatBytes, formatDate, isItemFailed, isItemProcessing, isItemLocked } from "../../utils/format";
import { getItemIcon } from "./FileIcon";
import { Checkbox } from "../common/Checkbox";
import { ContextMenuPortal } from "../common/ContextMenuPortal";
import type { AnchorRect } from "../common/ContextMenuPortal";


function SortableHeader({
  label,
  field,
  sortField,
  sortOrder,
  onSort,
  className = "",
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <th
      className={`sticky top-0 z-10 bg-bg-main px-3 py-2 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-code-bg hover:text-text-heading transition ${className}`}
      aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active &&
          (sortOrder === "asc" ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          ))}
      </span>
    </th>
  );
}

export function FileListTable({
  items,
  selectedItemId,
  checkedItemIds,
  contextMenuId,
  dragOverFolderId,
  sortField,
  sortOrder,
  onSortFieldChange,
  onToggleSortOrder,
  onItemClick,
  onCheckboxToggle,
  onSelectAllToggle,
  onContextMenuToggle,
  onItemContextMenu,
  renderContextMenu,
  onShare,
  onCopyLink,
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
  sortField: SortField;
  sortOrder: SortOrder;
  onSortFieldChange: (field: SortField) => void;
  onToggleSortOrder: () => void;
  onItemClick: (item: FileItem, e: React.MouseEvent) => void;
  onCheckboxToggle: (id: string, e: React.MouseEvent) => void;
  onSelectAllToggle: () => void;
  onContextMenuToggle: (id: string | null) => void;
  onItemContextMenu: (item: FileItem, e: React.MouseEvent) => void;
  renderContextMenu: (item: FileItem) => ReactNode;
  onShare?: (item: FileItem) => void;
  onCopyLink?: (item: FileItem) => void;
  onDragStartItem: (item: FileItem, e: React.DragEvent) => void;
  onDragOverFolder: (item: FileItem, e: React.DragEvent) => void;
  onDragLeaveFolder: (item: FileItem) => void;
  onDropOnFolder: (item: FileItem, e: React.DragEvent) => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<{ rect: AnchorRect; align: "start" | "end" } | null>(null);

  const handleSort = (field: SortField) => {
    if (field === sortField) onToggleSortOrder();
    else onSortFieldChange(field);
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr onMouseDown={(e) => e.stopPropagation()}>
            <th className="sticky top-0 z-10 bg-bg-main px-3 py-2 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider w-10 text-center" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={items.length > 0 && items.every((item) => checkedItemIds.includes(item.id))}
                indeterminate={items.some((item) => checkedItemIds.includes(item.id))}
                onChange={onSelectAllToggle}
                ariaLabel="Select all"
              />
            </th>
            <SortableHeader label="Name" field="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <th className="sticky top-0 z-10 bg-bg-main px-3 py-2 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider max-[640px]:hidden">Owner</th>
            <SortableHeader
              label="Last Modified"
              field="modifiedAt"
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="max-[860px]:hidden"
            />
            <SortableHeader label="Size" field="size" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <th className="sticky top-0 z-10 bg-bg-main px-3 py-2 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider w-20"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isSel = selectedItemId === item.id;
            const isChecked = checkedItemIds.includes(item.id);
            const isDragOver = item.isFolder && dragOverFolderId === item.id;
            const locked = isItemLocked(item);
            return (
              <tr
                key={item.id}
                data-item-id={item.id}
                draggable={!locked}
                onDragStart={(e) => onDragStartItem(item, e)}
                onDragOver={(e) => item.isFolder && onDragOverFolder(item, e)}
                onDragLeave={() => item.isFolder && onDragLeaveFolder(item)}
                onDrop={(e) => item.isFolder && onDropOnFolder(item, e)}
                className={`cursor-pointer group transition duration-150 ${
                  isSel ? "bg-accent-bg/70!" : isChecked ? "bg-accent-bg/70!" : "hover:bg-code-bg"
                } ${isDragOver ? "bg-accent-bg! outline-2 outline-accent -outline-offset-2" : ""}`}
                onClick={(e) => onItemClick(item, e)}
                onContextMenu={(e) => {
                  setMenuAnchor({ rect: { top: e.clientY, left: e.clientX, right: e.clientX, bottom: e.clientY }, align: "start" });
                  onItemContextMenu(item, e);
                }}
              >
                <td className="px-3 py-2 border-b border-border-main text-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isChecked}
                    onChange={(_, e) => onCheckboxToggle(item.id, e as unknown as React.MouseEvent)}
                    ariaLabel={`Select ${item.name}`}
                  />
                </td>
                <td className="px-3 py-2 border-b border-border-main">
                  <div className="flex items-center gap-2.5 text-[0.85rem] font-medium text-text-heading overflow-hidden whitespace-nowrap">
                    {getItemIcon(item, "w-4 h-4")}
                    <span className="truncate">{item.name}</span>
                    {!item.isFolder && locked && (
                      <span title="File is locked" className="inline-flex items-center p-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 border-b border-border-main text-[0.8rem] text-text-heading font-medium max-[640px]:hidden truncate">
                  {item.createdBy || item.owner.name}
                </td>
                <td className="px-3 py-2 border-b border-border-main text-xs text-text-main max-[860px]:hidden">{formatDate(item.modifiedAt)}</td>
                <td className="px-3 py-2 border-b border-border-main text-xs text-text-main">
                  {item.isFolder ? (
                    item.size > 0 ? formatBytes(item.size) : "—"
                  ) : isItemFailed(item) ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                      <AlertCircle className="w-3 h-3" />
                      Failed
                    </span>
                  ) : !item.isFolder && locked ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <Lock className="w-3 h-3 text-amber-500" />
                      Locked
                    </span>
                  ) : isItemProcessing(item) ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                      Processing
                    </span>
                  ) : (
                    formatBytes(item.size)
                  )}
                </td>
                <td className="px-3 py-2 border-b border-border-main text-right relative whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {onShare && !item.isDeleted && item.origin !== "shared" && !item.sharedIn && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onShare(item);
                        }}
                        title="Share"
                        className="border-none bg-transparent p-1.5 rounded-full text-text-main hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-text-heading cursor-pointer inline-flex items-center justify-center transition"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    )}
                    {onCopyLink && !item.isDeleted && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyLink(item);
                        }}
                        title="Copy link"
                        className="border-none bg-transparent p-1.5 rounded-full text-text-main hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-text-heading cursor-pointer inline-flex items-center justify-center transition"
                      >
                        <Link2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        const opening = contextMenuId !== item.id;
                        setMenuAnchor(opening ? { rect: e.currentTarget.getBoundingClientRect(), align: "end" } : null);
                        onContextMenuToggle(opening ? item.id : null);
                      }}
                      className="row-actions-trigger border-none bg-transparent p-1.5 rounded-full text-text-main hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-text-heading cursor-pointer inline-flex items-center justify-center transition"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                  {contextMenuId === item.id && menuAnchor && (
                    <ContextMenuPortal anchor={menuAnchor.rect} align={menuAnchor.align}>
                      {renderContextMenu(item)}
                    </ContextMenuPortal>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
