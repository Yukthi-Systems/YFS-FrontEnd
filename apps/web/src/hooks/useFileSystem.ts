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

// Reads services/fileSystemStore.ts (a singleton, wired to the session by
// components/FileSystemBridge.tsx) and re-exports its operations.
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
