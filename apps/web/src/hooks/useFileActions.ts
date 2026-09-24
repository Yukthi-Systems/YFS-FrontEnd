import { useState } from "react";
import type { FileItem } from "../types/file";
import type { ToastVariant } from "../atoms/toast";
import type { FileWithRelativePath } from "../atoms/uploadQueue";
import { downloadAsZip } from "../utils/zipDownload";
import { isItemLocked } from "../utils/format";
import { useDownload } from "./useDownload";

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => void;
}

interface MoveCopyState {
  mode: "move" | "restore";
  ids: string[];
}

// File/folder CRUD: create, rename, trash/restore/delete, move, download, and
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
    trashItems: (ids: string[]) => void;
    restoreItems: (ids: string[], destinationId: string | null) => { moved: number; blocked: number; unsupported: number };
    permanentDeleteItems: (ids: string[]) => Promise<{ deleted: number; blocked: number }>;
    deleteFileVersion: (item: FileItem, version: number) => Promise<boolean>;
    moveItems: (ids: string[], newParentId: string | null) => { moved: number; blocked: number; unsupported: number };
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
  const { fetchBlob, downloadFile } = useDownload();

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
    if (item.isDeleted) {
      showToast("Items in Trash can't be renamed — restore them first", "error");
      closeContextMenu();
      return;
    }
    if (isItemLocked(item)) {
      showToast(`"${item.name}" is locked and cannot be renamed`, "error");
      closeContextMenu();
      return;
    }
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

  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

  const requestTrash = (ids: string[]) => {
    if (ids.length === 0) return;
    const unlockedIds = ids.filter((id) => {
      const item = files.find((f) => f.id === id);
      return !isItemLocked(item);
    });
    if (unlockedIds.length === 0) {
      showToast("Locked items cannot be moved to Trash", "error");
      closeContextMenu();
      return;
    }
    if (unlockedIds.length < ids.length) {
      showToast(`Skipping ${ids.length - unlockedIds.length} locked item(s)`, "error");
    }

    closeContextMenu();
    setPendingConfirm({
      title: "Move to Trash",
      description: `Are you sure you want to move ${unlockedIds.length > 1 ? `${unlockedIds.length} items` : "this item"} to the Trash? You can restore ${
        unlockedIds.length > 1 ? "them" : "it"
      } later from the Trash tab.`,
      confirmLabel: "Move to Trash",
      destructive: true,
      onConfirm: () => {
        fileSystem.trashItems(unlockedIds);
        showToast(`Moved ${plural(unlockedIds.length, "item")} to Trash`, "success");
        setCheckedItemIds([]);
        clearSelection();
        closeContextMenu();
        setPendingConfirm(null);
      },
    });
  };

  // Permanent delete: local-only items (created offline, origin !== "server"/"shared")
  // are always droppable, whatever they are. Server-backed files go through
  // DELETE /files/delete/file, server-backed folders through DELETE /folders/delete
  // (recursive, purges its whole subtree). fileSystem.permanentDeleteItems sorts out
  // which of `removable` actually succeeds and reports real counts back — it's not
  // optimistic, this is irreversible.
  const requestPermanentDelete = (ids: string[]) => {
    if (ids.length === 0) return;
    const targets = ids.map((id) => files.find((f) => f.id === id)).filter((f): f is FileItem => !!f);
    const removable = targets.map((f) => f.id);
    if (removable.length === 0) return;

    closeContextMenu();
    setPendingConfirm({
      title: "Delete Permanently",
      description: `This will permanently delete ${removable.length > 1 ? `${removable.length} items` : "this item"}. This action cannot be undone.`,
      confirmLabel: "Delete Permanently",
      destructive: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        const { deleted, blocked } = await fileSystem.permanentDeleteItems(removable);
        if (deleted > 0) showToast(`Permanently deleted ${plural(deleted, "item")}`, "success");
        if (blocked > 0) showToast(`Couldn't permanently delete ${plural(blocked, "item")}`, "error");
        setCheckedItemIds([]);
        clearSelection();
        closeContextMenu();
      },
    });
  };

  // DELETE /files/delete/version — removes one older version from Version History.
  // Confirmed the same way as every other destructive action here, not optimistic:
  // the modal's list only drops the version once the server actually confirms it.
  //
  // isOnlyVersion (Version History's "no older versions" case) routes to
  // fileSystem.permanentDeleteItems instead — the server rejects /delete/version for a
  // file_version <= 1 or for the file's last remaining version, and conceptually
  // "delete the only version" just *is* "delete the file".
  const requestDeleteVersion = (item: FileItem, version: number, isOnlyVersion: boolean) => {
    closeContextMenu();
    setPendingConfirm({
      title: isOnlyVersion ? "Delete File" : "Delete Version",
      description: isOnlyVersion
        ? `Version ${version} is the only version of "${item.name}" — deleting it permanently deletes the file. This action cannot be undone.`
        : `This will permanently delete version ${version} of "${item.name}". This action cannot be undone.`,
      confirmLabel: isOnlyVersion ? "Delete File" : "Delete Version",
      destructive: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        if (isOnlyVersion) {
          const { deleted, blocked } = await fileSystem.permanentDeleteItems([item.id]);
          if (deleted > 0) showToast(`Permanently deleted "${item.name}"`, "success");
          if (blocked > 0) showToast(`Couldn't permanently delete "${item.name}"`, "error");
        } else {
          const ok = await fileSystem.deleteFileVersion(item, version);
          if (ok) showToast(`Deleted version ${version}`, "success");
        }
      },
    });
  };

  // Restore no longer auto-returns an item to where it was trashed from — it opens
  // the same destination-picker modal "Move to…" uses (see MoveCopyModal's
  // "restore" mode / handleMoveCopyConfirm below), so the user always chooses where
  // it lands.
  const handleRestore = (ids: string[]) => {
    if (ids.length === 0) return;
    setMoveCopyState({ mode: "restore", ids });
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
    if (ids.some((id) => files.find((f) => f.id === id)?.isDeleted)) {
      showToast("Items in Trash can't be moved — restore them first", "error");
      closeContextMenu();
      return;
    }
    const lockedItems = ids
      .map((id) => files.find((f) => f.id === id))
      .filter((f): f is FileItem => !!f && isItemLocked(f));
    if (lockedItems.length > 0) {
      if (ids.length === 1) {
        showToast(`"${lockedItems[0].name}" is locked and cannot be moved`, "error");
        closeContextMenu();
        return;
      }
      showToast(`Skipping ${lockedItems.length} locked item${lockedItems.length > 1 ? "s" : ""}`, "error");
      const unlockedIds = ids.filter((id) => !lockedItems.some((item) => item.id === id));
      if (unlockedIds.length === 0) {
        closeContextMenu();
        return;
      }
      setMoveCopyState({ mode: "move", ids: unlockedIds });
      closeContextMenu();
      return;
    }
    setMoveCopyState({ mode: "move", ids });
    closeContextMenu();
  };

  const closeMoveCopyModal = () => setMoveCopyState(null);

  const handleMoveCopyConfirm = (destinationId: string | null) => {
    if (!moveCopyState) return;
    if (moveCopyState.mode === "move") {
      const { moved, blocked, unsupported } = fileSystem.moveItems(moveCopyState.ids, destinationId);
      if (moved > 0) showToast(`Moved ${moved} item${moved > 1 ? "s" : ""}`, "success");
      if (blocked > 0) showToast(`Skipped ${blocked} item${blocked > 1 ? "s" : ""} — locked or cannot move into itself`, "error");
      if (unsupported > 0) showToast(`Skipped ${unsupported} file${unsupported > 1 ? "s" : ""} — moving a file to My Drive root isn't supported yet`, "error");
    } else if (moveCopyState.mode === "restore") {
      const { moved, blocked, unsupported } = fileSystem.restoreItems(moveCopyState.ids, destinationId);
      if (moved > 0) showToast(`Restored ${plural(moved, "item")}`, "success");
      if (blocked > 0) showToast(`Skipped ${plural(blocked, "item")} — locked or cannot restore into itself`, "error");
      if (unsupported > 0) showToast(`Skipped ${plural(unsupported, "file")} — restoring to My Drive root isn't supported yet`, "error");
    }
    setMoveCopyState(null);
    setCheckedItemIds([]);
  };

  const handleDownload = async (item: FileItem) => {
    closeContextMenu();

    if (item.isFolder) {
      showToast(`Zipping "${item.name}"…`, "info");
      const { skipped } = await downloadAsZip([item], files, item.name, fetchBlob);
      if (skipped > 0) showToast(`${skipped} item${skipped > 1 ? "s" : ""} had no content to include`, "error");
      return;
    }

    // blobUrl-only files resolve instantly (no real fetch), so only announce the
    // ones that actually hit the network — otherwise this toast outlives the download.
    if (item.origin === "server" || item.origin === "shared") showToast(`Downloading "${item.name}"…`, "info");
    try {
      const ok = await downloadFile(item);
      if (!ok) showToast("This file has no content to download", "error");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Download failed", "error");
    }
  };

  const handleBatchDownload = async (ids: string[]) => {
    const items = files.filter((f) => ids.includes(f.id));
    if (items.length === 0) return;

    if (items.length === 1 && !items[0].isFolder) {
      await handleDownload(items[0]);
      return;
    }

    try {
      showToast(`Zipping ${items.length} items…`, "info");
      const { skipped } = await downloadAsZip(items, files, "Download", fetchBlob);
      if (skipped > 0) showToast(`${skipped} item${skipped > 1 ? "s" : ""} had no content to include`, "error");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Download failed", "error");
    }
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
    requestTrash,
    requestPermanentDelete,
    requestDeleteVersion,
    handleRestore,
    pendingConfirm,
    closeConfirm,
    requestLogout,
    moveCopyState,
    openMoveModal,
    closeMoveCopyModal,
    handleMoveCopyConfirm,
    handleDownload,
    handleBatchDownload,
    handleSaveContent,
  };
}
