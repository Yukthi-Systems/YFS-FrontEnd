import { useState } from "react";
import type { FileItem } from "../types/file";
import type { ToastVariant } from "../context/ToastContext";
import type { FileWithRelativePath } from "../context/UploadQueueContext";
import { downloadAsZip } from "../utils/zipDownload";

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => void;
}

interface MoveCopyState {
  mode: "move" | "copy";
  ids: string[];
}

// File/folder CRUD: create, rename, star, trash/restore/delete, move/copy, download, and
// content saves. Bundled together since they all share the same fileSystem mutators, toast
// plumbing, and post-action cleanup (closing the context menu, clearing selection).
export function useFileActions({
  files,
  currentFolderId,
  fileSystem,
  enqueueFiles,
  showToast,
  logout,
  closeContextMenu,
  clearSelection,
  setCheckedItemIds,
}: {
  files: FileItem[];
  currentFolderId: string | null;
  fileSystem: {
    createFolder: (name: string, parentId: string | null) => FileItem | null;
    renameItem: (id: string, newName: string) => void;
    toggleStar: (id: string) => void;
    starItems: (ids: string[]) => void;
    trashItems: (ids: string[]) => void;
    restoreItems: (ids: string[]) => void;
    permanentDeleteItems: (ids: string[]) => void;
    moveItems: (ids: string[], newParentId: string | null) => { moved: number; blocked: number };
    copyItem: (id: string, newParentId: string | null) => { copied: number; blocked: boolean };
    updateFileContent: (id: string, blob: Blob) => Promise<void>;
  };
  enqueueFiles: (items: FileWithRelativePath[], parentId: string | null) => void;
  showToast: (message: string, variant?: ToastVariant) => void;
  logout: () => Promise<void>;
  closeContextMenu: () => void;
  clearSelection: () => void;
  setCheckedItemIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [activeModal, setActiveModal] = useState<"createFolder" | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [moveCopyState, setMoveCopyState] = useState<MoveCopyState | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const openCreateFolderModal = () => setActiveModal("createFolder");
  const closeCreateFolderModal = () => setActiveModal(null);

  const handleCreateFolderConfirm = (name: string) => {
    const folder = fileSystem.createFolder(name, currentFolderId);
    if (folder) showToast(`Created folder "${folder.name}"`, "success");
    else showToast("Folder name can't be empty", "error");
    setActiveModal(null);
  };

  const handleUploadFiles = (fileList: FileList, parentId: string | null) => {
    const items: FileWithRelativePath[] = Array.from(fileList).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
    }));
    const isFolderUpload = items.some((it) => it.relativePath.includes("/"));
    if (parentId === null && !isFolderUpload) {
      showToast("Open or create a folder to upload files — My Drive can't hold files directly", "error");
      return;
    }
    enqueueFiles(items, parentId);
  };

  const openRenameModal = (item: FileItem) => {
    setRenameTarget({ id: item.id, name: item.name });
    closeContextMenu();
  };

  const closeRenameModal = () => setRenameTarget(null);

  const handleRenameConfirm = (name: string) => {
    if (renameTarget) {
      fileSystem.renameItem(renameTarget.id, name);
      showToast("Renamed", "success");
    }
    setRenameTarget(null);
  };

  const handleToggleStar = (id: string) => {
    fileSystem.toggleStar(id);
    closeContextMenu();
  };

  const handleBatchStar = (ids: string[]) => {
    fileSystem.starItems(ids);
    showToast(`Starred ${ids.length} item${ids.length > 1 ? "s" : ""}`, "success");
    setCheckedItemIds([]);
  };

  const requestTrash = (ids: string[]) => {
    if (ids.length === 0) return;
    setPendingConfirm({
      title: "Move to Trash",
      description: `Are you sure you want to move ${ids.length > 1 ? `${ids.length} items` : "this item"} to the Trash? You can restore ${
        ids.length > 1 ? "them" : "it"
      } later from the Trash tab.`,
      confirmLabel: "Move to Trash",
      destructive: true,
      onConfirm: () => {
        fileSystem.trashItems(ids);
        showToast(`Moved ${ids.length > 1 ? `${ids.length} items` : "item"} to Trash`, "success");
        setCheckedItemIds([]);
        clearSelection();
        closeContextMenu();
        setPendingConfirm(null);
      },
    });
  };

  const requestPermanentDelete = (ids: string[]) => {
    if (ids.length === 0) return;
    setPendingConfirm({
      title: "Delete Permanently",
      description: `This will permanently delete ${ids.length > 1 ? `${ids.length} items` : "this item"}. This action cannot be undone.`,
      confirmLabel: "Delete Permanently",
      destructive: true,
      onConfirm: () => {
        fileSystem.permanentDeleteItems(ids);
        showToast(`Permanently deleted ${ids.length > 1 ? `${ids.length} items` : "item"}`, "success");
        setCheckedItemIds([]);
        clearSelection();
        closeContextMenu();
        setPendingConfirm(null);
      },
    });
  };

  const handleRestore = (ids: string[]) => {
    if (ids.length === 0) return;
    fileSystem.restoreItems(ids);
    showToast(`Restored ${ids.length > 1 ? `${ids.length} items` : "item"}`, "success");
    setCheckedItemIds([]);
    closeContextMenu();
  };

  const closeConfirm = () => setPendingConfirm(null);

  const requestLogout = () => {
    setPendingConfirm({
      title: "Logout Confirmation",
      description: "Are you sure you want to logout? You will need to login again to access the workspace.",
      confirmLabel: "Logout",
      destructive: true,
      onConfirm: () => {
        setPendingConfirm(null);
        logout();
      },
    });
  };

  const openMoveModal = (ids: string[]) => {
    setMoveCopyState({ mode: "move", ids });
    closeContextMenu();
  };

  const openCopyModal = (ids: string[]) => {
    setMoveCopyState({ mode: "copy", ids });
    closeContextMenu();
  };

  const closeMoveCopyModal = () => setMoveCopyState(null);

  const handleMoveCopyConfirm = (destinationId: string | null) => {
    if (!moveCopyState) return;
    if (moveCopyState.mode === "move") {
      const { moved, blocked } = fileSystem.moveItems(moveCopyState.ids, destinationId);
      if (moved > 0) showToast(`Moved ${moved} item${moved > 1 ? "s" : ""}`, "success");
      if (blocked > 0) showToast(`Skipped ${blocked} item${blocked > 1 ? "s" : ""} — can't move a folder into itself`, "error");
    } else {
      let totalCopied = 0;
      let anyBlocked = false;
      moveCopyState.ids.forEach((id) => {
        const { copied, blocked } = fileSystem.copyItem(id, destinationId);
        totalCopied += copied;
        if (blocked) anyBlocked = true;
      });
      if (totalCopied > 0) showToast(`Copied ${totalCopied} item${totalCopied > 1 ? "s" : ""}`, "success");
      if (anyBlocked) showToast("Skipped an item — can't copy a folder into itself", "error");
    }
    setMoveCopyState(null);
    setCheckedItemIds([]);
  };

  const handleDownload = async (item: FileItem) => {
    closeContextMenu();

    if (item.isFolder) {
      const { skipped } = await downloadAsZip([item], files, item.name);
      if (skipped > 0) showToast(`${skipped} item${skipped > 1 ? "s" : ""} had no content to include`, "error");
      return;
    }

    const link = document.createElement("a");
    if (item.blobUrl) {
      link.href = item.blobUrl;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const blob = new Blob([`Seeded File: ${item.name}\nSize: ${item.size} bytes`], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleBatchDownload = async (ids: string[]) => {
    const items = files.filter((f) => ids.includes(f.id));
    if (items.length === 0) return;

    if (items.length === 1 && !items[0].isFolder) {
      await handleDownload(items[0]);
      return;
    }

    const { skipped } = await downloadAsZip(items, files, "Download");
    if (skipped > 0) showToast(`${skipped} item${skipped > 1 ? "s" : ""} had no content to include`, "error");
  };

  const handleSaveContent = async (id: string, blob: Blob) => {
    await fileSystem.updateFileContent(id, blob);
    showToast("Saved", "success");
  };

  return {
    activeModal,
    openCreateFolderModal,
    closeCreateFolderModal,
    handleCreateFolderConfirm,
    handleUploadFiles,
    renameTarget,
    openRenameModal,
    closeRenameModal,
    handleRenameConfirm,
    handleToggleStar,
    handleBatchStar,
    requestTrash,
    requestPermanentDelete,
    handleRestore,
    pendingConfirm,
    closeConfirm,
    requestLogout,
    moveCopyState,
    openMoveModal,
    openCopyModal,
    closeMoveCopyModal,
    handleMoveCopyConfirm,
    handleDownload,
    handleBatchDownload,
    handleSaveContent,
  };
}
