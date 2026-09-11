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

// The whole client-side file tree (root + shared + trash) as one flat list, plus the
// handful of sibling buckets (sharedOut, sharedLinks, pagination) that go with it.
// Written to by services/fileSystemStore.ts (the only place with write access to the
// underlying data); read anywhere via hooks/useFileSystem.ts.
export const filesAtom = atom<FileItem[]>([]);
export const isLoadingAtom = atom<boolean>(true);
// `atom(null as string | null)` rather than `atom<string | null>(null)`: this repo
// builds with strictNullChecks off, so a bare `null` argument is structurally
// assignable to jotai's `Read<Value>` (a function type) and overload resolution
// picks the read-only `atom(read): Atom<Value>` overload instead of the primitive
// (writable) one — silently making the atom read-only. Casting the initial value so
// its static type includes `string` (never assignable to a function type) rules that
// overload out regardless of strictNullChecks.
export const remoteErrorAtom = atom(null as string | null);
export const pageInfoAtom = atom<Record<string, PaginationInfo>>({});
export const trashFolderIdAtom = atom(null as string | null);
export const sharedOutAtom = atom<FileItem[]>([]);
export const sharedLinksAtom = atom<ExternalShare[]>([]);
