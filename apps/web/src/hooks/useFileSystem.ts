import { useAtomValue } from "jotai";
import {
  filesAtom,
  isLoadingAtom,
  remoteErrorAtom,
  pageInfoAtom,
  trashFolderIdAtom,
  sharedOutAtom,
  sharedLinksAtom,
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
  getSharedFolderId,
  getSharedPermissions,
  createFolder,
  ensureFolderPath,
  addFile,
  renameItem,
  toggleStar,
  starItems,
  setFolderStyle,
  trashItems,
  restoreItems,
  permanentDeleteItems,
  moveItems,
  copyItem,
  updateFileContent,
  restoreVersion,
  setShareSettings,
  clearShareSettings,
  getDescendantIds,
} from "../services/fileSystemStore";

export type { AddFileInput, PaginationInfo } from "../atoms/fileSystem";

// Reads services/fileSystemStore.ts (a singleton, wired to the session by
// components/FileSystemBridge.tsx) and re-exports its operations.
export const useFileSystem = () => {
  const files = useAtomValue(filesAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  const remoteError = useAtomValue(remoteErrorAtom);
  const pageInfo = useAtomValue(pageInfoAtom);
  const trashFolderId = useAtomValue(trashFolderIdAtom);
  const sharedOut = useAtomValue(sharedOutAtom);
  const sharedLinks = useAtomValue(sharedLinksAtom);

  const getPagination = (parentId: string | null, shared?: boolean): PaginationInfo =>
    pageInfo[pageKeyFor(parentId, shared)] ?? { hasMore: false, loading: false };

  return {
    files,
    isLoading,
    remoteError,
    loadFolder,
    loadMoreFolder,
    loadSharedFolders,
    loadMoreSharedFolders,
    sharedOut,
    loadSharedOut,
    sharedLinks,
    loadSharedLinks,
    revokeSharedLink,
    getPagination,
    createFolder,
    ensureFolderPath,
    trashFolderId,
    addFile,
    renameItem,
    toggleStar,
    starItems,
    setFolderStyle,
    trashItems,
    restoreItems,
    permanentDeleteItems,
    moveItems,
    copyItem,
    updateFileContent,
    restoreVersion,
    setShareSettings,
    clearShareSettings,
    getDescendantIds,
    getSharedFolderId,
    getSharedPermissions,
  };
};
