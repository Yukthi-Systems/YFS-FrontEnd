import { useState } from "react";
import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import type { FileItem } from "../../types/file";
import { formatBytes, formatDate } from "../../utils/format";
import { getItemIcon } from "./FileIcon";
import { ContextMenuPortal } from "../common/ContextMenuPortal";
import type { AnchorRect } from "../common/ContextMenuPortal";

export function FileListTable({
  items,
  selectedItemId,
  checkedItemIds,
  contextMenuId,
  dragOverFolderId,
  onItemClick,
  onCheckboxToggle,
  onSelectAllToggle,
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
  onSelectAllToggle: () => void;
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
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className="sticky top-0 z-10 bg-bg-main px-3 py-2 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider w-10 text-center" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={items.length > 0 && items.every((item) => checkedItemIds.includes(item.id))}
                onChange={onSelectAllToggle}
              />
            </th>
            <th className="sticky top-0 z-10 bg-bg-main px-3 py-2 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider">Name</th>
            <th className="sticky top-0 z-10 bg-bg-main px-3 py-2 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider max-[640px]:hidden">Owner</th>
            <th className="sticky top-0 z-10 bg-bg-main px-3 py-2 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider max-[980px]:hidden">Created By</th>
            <th className="sticky top-0 z-10 bg-bg-main px-3 py-2 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider max-[860px]:hidden">Last Modified</th>
            <th className="sticky top-0 z-10 bg-bg-main px-3 py-2 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider">Size</th>
            <th className="sticky top-0 z-10 bg-bg-main px-3 py-2 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider w-12"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isSel = selectedItemId === item.id;
            const isChecked = checkedItemIds.includes(item.id);
            const isDragOver = item.isFolder && dragOverFolderId === item.id;
            return (
              <tr
                key={item.id}
                draggable
                onDragStart={(e) => onDragStartItem(item, e)}
                onDragOver={(e) => item.isFolder && onDragOverFolder(item, e)}
                onDragLeave={() => item.isFolder && onDragLeaveFolder(item)}
                onDrop={(e) => item.isFolder && onDropOnFolder(item, e)}
                className={`cursor-pointer transition duration-150 ${isSel ? "bg-accent-bg!" : "hover:bg-code-bg"} ${
                  isDragOver ? "bg-accent-bg! outline-2 outline-accent -outline-offset-2" : ""
                }`}
                onClick={(e) => onItemClick(item, e)}
                onContextMenu={(e) => {
                  setMenuAnchor({ rect: { top: e.clientY, left: e.clientX, right: e.clientX, bottom: e.clientY }, align: "start" });
                  onItemContextMenu(item, e);
                }}
              >
                <td className="px-3 py-2 border-b border-border-main text-center" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isChecked} onChange={(e) => onCheckboxToggle(item.id, e as unknown as React.MouseEvent)} />
                </td>
                <td className="px-3 py-2 border-b border-border-main">
                  <div className="flex items-center gap-2.5 text-[0.85rem] font-medium text-text-heading overflow-hidden whitespace-nowrap">
                    {getItemIcon(item, "w-4 h-4")}
                    <span className="truncate">{item.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 border-b border-border-main max-[640px]:hidden">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px]">
                      {item.owner.name.substring(0, 1).toUpperCase()}
                    </div>
                    <span className="text-[0.8rem] text-text-heading font-medium">{item.owner.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 border-b border-border-main text-xs text-text-main max-[980px]:hidden">{item.createdBy || "—"}</td>
                <td className="px-3 py-2 border-b border-border-main text-xs text-text-main max-[860px]:hidden">{formatDate(item.modifiedAt)}</td>
                <td className="px-3 py-2 border-b border-border-main text-xs text-text-main">{formatBytes(item.size)}</td>
                <td className="px-3 py-2 border-b border-border-main text-center relative" onClick={(e) => e.stopPropagation()}>
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
