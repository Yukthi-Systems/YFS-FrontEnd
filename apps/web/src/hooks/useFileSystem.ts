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

import { useAtomValue } from "jotai";
import {
  filesAtom,
  isLoadingAtom,
  remoteErrorAtom,
  pageInfoAtom,
  trashFolderIdAtom,
  idRemapAtom,
  sharedOutAtom,
  sharedOutLoadingAtom,
  sharedOutLoadedAtom,
  sharedLinksAtom,
  sharedLinksLoadingAtom,
  sharedLinksLoadedAtom,
  type PaginationInfo,
} from "../atoms/fileSystem";
import {
  pageKeyFor,
  loadFolder,
  loadMoreFolder,
  loadSharedFolders,
  loadMoreSharedFolders,
  loadSharedOut,
  loadSharedLinks,
  revokeSharedLink,
  updateSharedLink,
  getSharedFolderId,
  getSharedPermissions,
  createFolder,
  ensureFolderPath,
  addFile,
  buildCreationInfo,
  fileTypeGuess,
  renameItem,
  setFolderStyle,
  setItemDescription,
  trashItems,
  restoreItems,
  permanentDeleteItems,
  deleteFileVersion,
  moveItems,
  updateFileContent,
  restoreVersion,
  setShareSettings,
  clearShareSettings,
  getDescendantIds,
  setItemLocked,
} from "../services/fileSystemStore";

export type { AddFileInput, PaginationInfo } from "../atoms/fileSystem";

export const useFileSystem = () => {
  const files = useAtomValue(filesAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  const remoteError = useAtomValue(remoteErrorAtom);
  const pageInfo = useAtomValue(pageInfoAtom);
  const trashFolderId = useAtomValue(trashFolderIdAtom);
  const idRemap = useAtomValue(idRemapAtom);
  const sharedOut = useAtomValue(sharedOutAtom);
  const sharedOutLoading = useAtomValue(sharedOutLoadingAtom);
  const sharedOutLoaded = useAtomValue(sharedOutLoadedAtom);
  const sharedLinks = useAtomValue(sharedLinksAtom);
  const sharedLinksLoading = useAtomValue(sharedLinksLoadingAtom);
  const sharedLinksLoaded = useAtomValue(sharedLinksLoadedAtom);

  const getPagination = (parentId: string | null, shared?: boolean): PaginationInfo =>
    pageInfo[pageKeyFor(parentId, shared)] ?? { hasMore: true, loading: true, loaded: false };

  return {
    files,
    isLoading,
    remoteError,
    loadFolder,
    loadMoreFolder,
    loadSharedFolders,
    loadMoreSharedFolders,
    sharedOut,
    sharedOutLoading,
    sharedOutLoaded,
    loadSharedOut,
    sharedLinks,
    sharedLinksLoading,
    sharedLinksLoaded,
    loadSharedLinks,
    revokeSharedLink,
    updateSharedLink,
    getPagination,
    createFolder,
    ensureFolderPath,
    trashFolderId,
    idRemap,
    addFile,
    buildCreationInfo,
    fileTypeGuess,
    renameItem,
    setFolderStyle,
    setItemDescription,
    trashItems,
    restoreItems,
    permanentDeleteItems,
    deleteFileVersion,
    moveItems,
    updateFileContent,
    restoreVersion,
    setShareSettings,
    clearShareSettings,
    getDescendantIds,
    getSharedFolderId,
    getSharedPermissions,
    setItemLocked,
  };
};
