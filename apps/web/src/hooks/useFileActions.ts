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
import type { FileItem } from "../types/file";
import type { ToastVariant } from "../atoms/toast";
import type { FileWithRelativePath } from "../atoms/uploadQueue";
import { downloadAsZip } from "../utils/zipDownload";
import { busyMessage, canDownloadItem, itemBusyReason, shortName } from "../utils/format";
import { canArchiveOnServer, useDownload, useFolderArchive } from "./useDownload";
import type { ArchiveExportType } from "@yfs/service";
import type { MoveResult } from "../services/fileSystemStore";

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

// File/folder actions with their toasts and post-action cleanup.
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
    createFolder: (name: string, parentId: string | null) => { folder: FileItem; synced: Promise<boolean> } | null;
    renameItem: (id: string, newName: string) => Promise<boolean>;
    trashItems: (ids: string[]) => Promise<MoveResult>;
    restoreItems: (ids: string[], destinationId: string | null) => Promise<MoveResult>;
    permanentDeleteItems: (ids: string[]) => Promise<{ deleted: number; blocked: number }>;
    deleteFileVersion: (item: FileItem, version: number) => Promise<boolean>;
    moveItems: (ids: string[], newParentId: string | null) => Promise<MoveResult>;
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
  const { startFolderArchive } = useFolderArchive();

  const openCreateFolderModal = () => setActiveModal("createFolder");
  const closeCreateFolderModal = () => setActiveModal(null);

  const handleCreateFolderConfirm = async (name: string) => {
    setActiveModal(null);
    const created = fileSystem.createFolder(name, currentFolderId);
    if (!created) {
      showToast("Folder name can't be empty", "error");
      return;
    }
    if (await created.synced) showToast(`Created folder "${shortName(created.folder.name)}"`, "success");
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

  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

  // Drops locked/processing items, telling the user why; returns the ids that can proceed.
  const withoutBusy = (ids: string[], action: string): string[] => {
    const items = ids.map((id) => files.find((f) => f.id === id)).filter((f): f is FileItem => !!f);
    const busy = items.filter((f) => itemBusyReason(f));
    if (busy.length === 1 && items.length === 1) showToast(busyMessage(busy[0], action)!, "error");
    else if (busy.length > 0) showToast(`Skipping ${plural(busy.length, "item")} that are locked or still processing`, "error");
    return items.filter((f) => !itemBusyReason(f)).map((f) => f.id);
  };

  const openRenameModal = (item: FileItem) => {
    if (item.isDeleted) {
      showToast("Items in Trash can't be renamed — restore them first", "error");
      closeContextMenu();
      return;
    }
    if (withoutBusy([item.id], "renamed").length === 0) {
      closeContextMenu();
      return;
    }
    setRenameTarget({ id: item.id, name: item.name });
    closeContextMenu();
  };

  const closeRenameModal = () => setRenameTarget(null);

  const handleRenameConfirm = async (name: string) => {
    const target = renameTarget;
    setRenameTarget(null);
    if (target && (await fileSystem.renameItem(target.id, name))) showToast("Renamed", "success");
  };

  const requestTrash = (ids: string[]) => {
    if (ids.length === 0) return;
    const unlockedIds = withoutBusy(ids, "moved to Trash");
    if (unlockedIds.length === 0) {
      closeContextMenu();
      return;
    }

    closeContextMenu();
    setPendingConfirm({
      title: "Move to Trash",
      description: `Are you sure you want to move ${unlockedIds.length > 1 ? `${unlockedIds.length} items` : "this item"} to the Trash? You can restore ${
        unlockedIds.length > 1 ? "them" : "it"
      } later from the Trash tab.`,
      confirmLabel: "Move to Trash",
      destructive: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        setCheckedItemIds([]);
        clearSelection();
        closeContextMenu();
        const { moved } = await fileSystem.trashItems(unlockedIds);
        if (moved > 0) showToast(`Moved ${plural(moved, "item")} to Trash`, "success");
      },
    });
  };

  // Not optimistic: permanentDeleteItems reports what actually succeeded.
  const requestPermanentDelete = (ids: string[]) => {
    if (ids.length === 0) return;
    const removable = withoutBusy(ids, "deleted");
    if (removable.length === 0) {
      closeContextMenu();
      return;
    }

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

  // Deleting the only version deletes the file; the server rejects /delete/version for it.
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
          if (deleted > 0) showToast(`Permanently deleted "${shortName(item.name)}"`, "success");
          if (blocked > 0) showToast(`Couldn't permanently delete "${shortName(item.name)}"`, "error");
        } else {
          const ok = await fileSystem.deleteFileVersion(item, version);
          if (ok) showToast(`Deleted version ${version}`, "success");
        }
      },
    });
  };

  // Restore opens the destination picker so the user chooses where it goes.
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
    const movable = withoutBusy(ids, "moved");
    closeContextMenu();
    if (movable.length > 0) setMoveCopyState({ mode: "move", ids: movable });
  };

  const closeMoveCopyModal = () => setMoveCopyState(null);

  const handleMoveCopyConfirm = async (destinationId: string | null) => {
    if (!moveCopyState) return;
    const { mode, ids } = moveCopyState;
    setMoveCopyState(null);
    setCheckedItemIds([]);
    const restoring = mode === "restore";
    const { moved, blocked, unsupported } = restoring
      ? await fileSystem.restoreItems(ids, destinationId)
      : await fileSystem.moveItems(ids, destinationId);
    if (moved > 0) showToast(`${restoring ? "Restored" : "Moved"} ${plural(moved, "item")}`, "success");
    if (blocked > 0)
      showToast(`Skipped ${plural(blocked, "item")} — locked, still processing, or can't go into itself`, "error");
    if (unsupported > 0)
      showToast(`Skipped ${plural(unsupported, "file")} — ${restoring ? "restoring" : "moving"} a file to My Drive root isn't supported yet`, "error");
  };

  const handleDownload = async (item: FileItem, format: ArchiveExportType = "zip") => {
    closeContextMenu();

    if (canArchiveOnServer(item)) {
      await startFolderArchive(item, format);
      return;
    }
    if (item.isFolder) {
      showToast(`Zipping "${shortName(item.name)}"…`, "info");
      const { skipped } = await downloadAsZip([item], files, item.name, fetchBlob);
      if (skipped > 0) showToast(`${skipped} item${skipped > 1 ? "s" : ""} had no content to include`, "error");
      return;
    }

    // Only announce real network downloads.
    if (item.origin === "server" || item.origin === "shared") showToast(`Downloading "${shortName(item.name)}"…`, "info");
    try {
      const ok = await downloadFile(item);
      if (!ok) showToast("This file has no content to download", "error");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Download failed", "error");
    }
  };

  const handleBatchDownload = async (ids: string[]) => {
    const selected = files.filter((f) => ids.includes(f.id));
    const items = selected.filter(canDownloadItem);
    const skipped = selected.length - items.length;
    if (skipped > 0) showToast(`Skipping ${plural(skipped, "file")} that are still processing or failed`, "error");
    if (items.length === 0) return;

    if (items.length === 1) {
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
