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

import { apiRequest } from "./apiClient";
import { PAGE_SIZE } from "./types";
import type { BackendResource, PageQuery } from "./types";

// Stored verbatim in folder_info/file_info; unknown keys are preserved on edit.
export interface FolderCreationInfo {
  user_id?: string;
  // Creator name is resolved live from user_id so it doesn't go stale.
}

export interface ResourceUiInfo {
  color?: string; // CSS colour, e.g. "#e8710a"
  icon?: string;
}

// Trash is a regular folder, so nothing here marks an item as trashed.
export interface ResourceInfo {
  creation_info?: FolderCreationInfo;
  ui?: ResourceUiInfo;
  description?: string;
  [key: string]: unknown;
}

const DEFAULT_PAGE: PageQuery = { limit: PAGE_SIZE, offset: 0 };

const pageParams = (page: Partial<PageQuery> = {}): string => {
  const { limit, offset } = { ...DEFAULT_PAGE, ...page };
  return `?limit=${limit}&offset=${offset}`;
};

// GET /folders/list/root — top-level folders (and files) for the signed-in user.
export const listRootFolders = async (
  accessToken: string,
  page?: Partial<PageQuery>
): Promise<BackendResource[]> => {
  const { data } = await apiRequest<BackendResource[]>(`/folders/list/root${pageParams(page)}`, { accessToken });
  return data ?? [];
};

// GET /folders/list/under/{parentFolderId} — direct children of a folder.
export const listFolderChildren = async (
  accessToken: string,
  parentFolderId: string,
  page?: Partial<PageQuery>
): Promise<BackendResource[]> => {
  const { data } = await apiRequest<BackendResource[]>(
    `/folders/list/under/${parentFolderId}${pageParams(page)}`,
    { accessToken }
  );
  return data ?? [];
};

// Set only for targets inside a "Shared with me" folder.
type SharedFolderScope = { sharedFolderId?: string | null };

// POST /folders/create — no echo; re-list the parent.
export const createFolder = async (
  accessToken: string,
  params: {
    parentFolderId: string | null;
    folderName: string;
    folderInfo?: Record<string, unknown>;
  } & SharedFolderScope
): Promise<void> => {
  await apiRequest("/folders/create", {
    accessToken,
    method: "POST",
    parseJson: false,
    body: JSON.stringify({
      parent_folder_id: params.parentFolderId,
      shared_folder_id: params.sharedFolderId ?? null,
      folder_name: params.folderName,
      folder_info: params.folderInfo ?? {},
    }),
  });
};

// PATCH /folders/edit — rename / update metadata.
export const editFolder = async (
  accessToken: string,
  params: {
    folderId: string;
    folderName: string;
    folderInfo?: Record<string, unknown>;
  } & SharedFolderScope
): Promise<void> => {
  await apiRequest("/folders/edit", {
    accessToken,
    method: "PATCH",
    parseJson: false,
    body: JSON.stringify({
      folder_id: params.folderId,
      shared_folder_id: params.sharedFolderId ?? null,
      folder_name: params.folderName,
      folder_info: params.folderInfo ?? {},
    }),
  });
};

// DELETE /folders/delete — deletes the subtree in the background; 202 once queued.
export const deleteFolder = async (
  accessToken: string,
  params: {
    folderId: string;
    folderName: string;
    folderInfo?: Record<string, unknown>;
  } & SharedFolderScope
): Promise<void> => {
  await apiRequest("/folders/delete", {
    accessToken,
    method: "DELETE",
    parseJson: false,
    body: JSON.stringify({
      folder_id: params.folderId,
      shared_folder_id: params.sharedFolderId ?? null,
      folder_name: params.folderName,
      folder_info: params.folderInfo ?? {},
    }),
  });
};

// PUT /folders/move — re-parent a folder (null = move to root).
export const moveFolder = async (
  accessToken: string,
  params: { folderId: string; newParentFolderId: string | null } & SharedFolderScope
): Promise<void> => {
  await apiRequest("/folders/move", {
    accessToken,
    method: "PUT",
    parseJson: false,
    body: JSON.stringify({
      folder_id: params.folderId,
      new_parent_folder_id: params.newParentFolderId,
      shared_folder_id: params.sharedFolderId ?? null,
    }),
  });
};

export type ArchiveExportType = "zip" | "tar";

// Archive job created by the YFS Archive API; progress streams from `events_url` (SSE).
export interface FolderArchiveJob {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed" | "expired";
  events_url: string;
  expires_in: number;
}

// Payload of the SSE "progress" event.
export interface ArchiveProgressEvent {
  processed_files: number;
  total_files: number;
  processed_bytes: number;
  total_bytes: number;
}

// Payload of the SSE "completed" event; fetch `download_url?token=download_token`.
export interface ArchiveCompletedEvent {
  job_id: string;
  download_url: string;
  download_token: string;
  expires_in: number;
}

// POST /folders/download/{export_type} — queues an archive of the folder. 422 if it's empty or over the size limit.
export const requestFolderArchive = async (
  accessToken: string,
  params: {
    folderId: string;
    archiveName: string;
    exportType: ArchiveExportType;
    folderInfo?: Record<string, unknown>;
  } & SharedFolderScope
): Promise<FolderArchiveJob> => {
  const { data } = await apiRequest<FolderArchiveJob>(`/folders/download/${params.exportType}`, {
    accessToken,
    method: "POST",
    body: JSON.stringify({
      folder_id: params.folderId,
      shared_folder_id: params.sharedFolderId ?? null,
      folder_name: params.archiveName,
      folder_info: params.folderInfo ?? {},
    }),
  });
  return data;
};
