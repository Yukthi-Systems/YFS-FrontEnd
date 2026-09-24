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
  fileId?: string;
  version?: number;
}

export interface PaginationInfo {
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
}

// Written by services/fileSystemStore.ts; read via hooks/useFileSystem.ts.
export const filesAtom = atom<FileItem[]>([]);
export const isLoadingAtom = atom<boolean>(true);
// `null as T | null`, not `atom<T | null>(null)`: with strictNullChecks off the latter picks jotai's read-only overload.
export const remoteErrorAtom = atom(null as string | null);
export const pageInfoAtom = atom<Record<string, PaginationInfo>>({});
export const trashFolderIdAtom = atom(null as string | null);
// Temp id → server id, so anything holding a temp id (e.g. the breadcrumb path) can follow it.
export const idRemapAtom = atom<Record<string, string>>({});
export const sharedOutAtom = atom<FileItem[]>([]);
export const sharedOutLoadingAtom = atom<boolean>(false);
export const sharedOutLoadedAtom = atom<boolean>(false);
export const sharedLinksAtom = atom<ExternalShare[]>([]);
export const sharedLinksLoadingAtom = atom<boolean>(false);
export const sharedLinksLoadedAtom = atom<boolean>(false);
