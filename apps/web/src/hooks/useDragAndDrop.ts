import { useState } from "react";
import type { FileItem } from "../types/file";
import type { ToastVariant } from "../atoms/toast";
import { isItemLocked } from "../utils/format";

export function useDragAndDrop({
  checkedItemIds,
  moveItems,
  showToast,
  onDropFiles,
}: {
  checkedItemIds: string[];
  moveItems: (ids: string[], newParentId: string | null) => { moved: number; blocked: number; unsupported: number };
  showToast: (message: string, variant?: ToastVariant) => void;
  onDropFiles: (fileList: FileList, parentId: string) => void;
}) {
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const handleDragStartItem = (item: FileItem, e: React.DragEvent) => {
    if (item.isDeleted) {
      e.preventDefault();
      showToast("Items in Trash can't be moved — restore them first", "error");
      return;
    }
    if (isItemLocked(item)) {
      e.preventDefault();
      showToast(`"${item.name}" is locked and cannot be moved`, "error");
      return;
    }
    e.dataTransfer.setData("application/x-yfs-item", item.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverFolder = (item: FileItem, e: React.DragEvent) => {
    if (item.isDeleted) return;
    e.preventDefault();
    setDragOverFolderId(item.id);
  };

  const handleDragLeaveFolder = (item: FileItem) => {
    setDragOverFolderId((prev) => (prev === item.id ? null : prev));
  };

  const handleDropOnFolder = (item: FileItem, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    if (item.isDeleted) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files, item.id);
      return;
    }

    const draggedId = e.dataTransfer.getData("application/x-yfs-item");
    if (!draggedId) return;
    const ids = checkedItemIds.includes(draggedId) ? checkedItemIds : [draggedId];
    const { moved, blocked } = moveItems(ids, item.id);
    if (moved > 0) showToast(`Moved ${moved} item${moved > 1 ? "s" : ""} into "${item.name}"`, "success");
    if (blocked > 0) showToast("Can't move a folder into itself", "error");
  };

  return { dragOverFolderId, handleDragStartItem, handleDragOverFolder, handleDragLeaveFolder, handleDropOnFolder };
}
