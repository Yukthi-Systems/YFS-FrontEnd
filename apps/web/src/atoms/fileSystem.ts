import { atom } from "jotai";
import type { FileItem } from "../types/file";
import type { ExternalShare } from "@yfs/service";

export interface AddFileInput {
  name: string;
  parentId: string | null;
  size: number;
  type: FileItem["type"];
  extension?: string;
  storageKey: string;
  blob: Blob;
  fileId?: string; // logical files.file_id from the upload backend
  version?: number; // file_versions.file_version this upload produced
}

// Per-folder infinite-scroll state, exposed so the UI can render a loading row and
// know when to stop asking for more.
export interface PaginationInfo {
  hasMore: boolean;
  loading: boolean;
}

// Written by services/fileSystemStore.ts; read via hooks/useFileSystem.ts.
export const filesAtom = atom<FileItem[]>([]);
export const isLoadingAtom = atom<boolean>(true);
// `null as T | null` rather than `atom<T | null>(null)`: with strictNullChecks off,
// a bare `null` matches jotai's read-only atom(read) overload instead of the
// writable one. The cast keeps `string` in the value's static type, which isn't
// assignable to that overload's function parameter, so it resolves correctly.
export const remoteErrorAtom = atom(null as string | null);
export const pageInfoAtom = atom<Record<string, PaginationInfo>>({});
export const trashFolderIdAtom = atom(null as string | null);
export const sharedOutAtom = atom<FileItem[]>([]);
export const sharedLinksAtom = atom<ExternalShare[]>([]);
