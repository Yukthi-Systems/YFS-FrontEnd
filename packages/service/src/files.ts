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

// File upload/download/metadata calls under YFS-Main-API's /files scope.

export interface FileUploadRequest {
  folder_id: string; // immediate parent folder id
  file_id?: string | null;
  shared_folder_id?: string | null; // accepted but not yet acted on server-side
  file_name: string;
  file_info: Record<string, unknown>; // UI metadata (colour, icon, …); {} if none
  file_type: string; // MIME, e.g. "text/plain"
  file_version: number; // 1 for a new file, otherwise latest + 1
  expected_file_size: number; // bytes
}

// One upload slot for one file (YFS-Files-Api models.UploadSession).
export interface UploadSession {
  file_name: string;
  expected_file_size: number;
  token: string; // sent as `Authorization: Bearer` to tus
  file_id: string; // stable across versions
  file_version: number;
  folder_id: string;
  owner_id: string;
  expires_at: string; // RFC3339
  base_url: string; // tus endpoint is `${base_url}/upload/tus/`
}

// POST /files/upload — one file per call.
export const requestFileUpload = async (accessToken: string, req: FileUploadRequest): Promise<UploadSession> => {
  const { data } = await apiRequest<UploadSession[]>("/files/upload", {
    accessToken,
    method: "POST",
    body: JSON.stringify(req),
  });
  const session = data?.[0];
  if (!session) throw new Error("Upload session response was empty");
  return session;
};

export interface FileInfoEdit {
  folder_id: string;
  file_id: string;
  shared_folder_id?: string | null;
  file_name: string;
  file_info: Record<string, unknown>;
  file_type: string;
  file_version: number;
  expected_file_size: number;
}

// PATCH /files/update — rename or edit metadata, not content.
export const updateFileInfo = async (accessToken: string, edit: FileInfoEdit): Promise<void> => {
  await apiRequest("/files/update", {
    accessToken,
    method: "PATCH",
    parseJson: false,
    body: JSON.stringify(edit),
  });
};

export interface FileDownloadRequest {
  folder_id: string;
  file_id: string;
  shared_folder_id?: string | null;
  file_name: string;
  file_info: Record<string, unknown>;
  file_type: string;
  file_version: number;
  expected_file_size: number;
}

// `url` already carries `?token=`, so it can be used directly as a src or fetched.
export interface DownloadSession {
  file_name: string;
  file_id: string;
  file_version: number;
  folder_id: string;
  owner_id: string;
  token: string;
  url: string;
  expires_at: string; // RFC3339
}

// POST /files/download — one file per call; the response is an array of one.
export const requestFileDownload = async (accessToken: string, req: FileDownloadRequest): Promise<DownloadSession> => {
  const { data } = await apiRequest<(Omit<DownloadSession, "token"> & { token?: string; access_token?: string })[]>(
    "/files/download",
    {
      accessToken,
      method: "POST",
      body: JSON.stringify(req),
    }
  );
  const session = data?.[0];
  if (!session) throw new Error("Download session response was empty");
  // Download sessions name it `access_token`, upload sessions `token`.
  return { ...session, token: session.access_token ?? session.token ?? "" };
};

export interface FileBasicInfo {
  file_id: string;
  folder_id: string;
  user_id: string;
  file_name: string;
  file_info: Record<string, unknown>;
  is_locked: boolean;
  available_versions: number[];
  created_at: string; // RFC3339
  updated_at: string; // RFC3339
}

// POST /files/get-info — validated like a download, so pass version 1, which always exists.
export const getFileBasicInfo = async (accessToken: string, req: FileDownloadRequest): Promise<FileBasicInfo> => {
  const { data } = await apiRequest<FileBasicInfo>("/files/get-info", {
    accessToken,
    method: "POST",
    body: JSON.stringify(req),
  });
  return data;
};

// folder_id is the current parent; files can't be moved to root.
export interface FileMoveRequest {
  folder_id: string;
  file_id: string;
  shared_folder_id?: string | null;
  file_name: string;
  file_info: Record<string, unknown>;
  file_type: string;
  file_version: number;
  expected_file_size: number;
}

// PUT /files/move/{destination_folder_id}
export const moveFile = async (
  accessToken: string,
  destinationFolderId: string,
  req: FileMoveRequest
): Promise<void> => {
  await apiRequest(`/files/move/${destinationFolderId}`, {
    accessToken,
    method: "PUT",
    parseJson: false,
    body: JSON.stringify(req),
  });
};

// Write access is a path parameter (`to_write`), not a body field.
export type FileWopiRequest = FileDownloadRequest;

// `url` is the WOPISrc to hand to Collabora, not something to fetch.
export interface WopiSession {
  wopi_src: string;
  token: string;
  expires_at: string; // RFC3339
  access_token_ttl: number; // epoch ms, as WOPI's access_token_ttl expects
}

interface RawWopiSession {
  url: string;
  access_token?: string;
  token?: string;
  expires_at: string;
  access_token_ttl?: number;
}

// file_version is the older version to delete; must be > 1.
export type FileVersionDeleteRequest = FileDownloadRequest;

// DELETE /files/delete/version — 204 on success.
export const deleteFileVersion = async (accessToken: string, req: FileVersionDeleteRequest): Promise<void> => {
  await apiRequest("/files/delete/version", {
    accessToken,
    method: "DELETE",
    parseJson: false,
    body: JSON.stringify(req),
  });
};

// Deleting a file removes every version, not just the one named.
export type FileDeleteRequest = FileDownloadRequest;

// DELETE /files/delete/file — removes every version; 204 on success.
export const deleteFile = async (accessToken: string, req: FileDeleteRequest): Promise<void> => {
  await apiRequest("/files/delete/file", {
    accessToken,
    method: "DELETE",
    parseJson: false,
    body: JSON.stringify(req),
  });
};

// POST /files/wopi/session/create/{to_write} — mints a WOPI session for Collabora.
export const requestWopiSession = async (
  accessToken: string,
  req: FileWopiRequest,
  toWrite: boolean
): Promise<WopiSession> => {
  const { data } = await apiRequest<RawWopiSession>(`/files/wopi/session/create/${toWrite}`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(req),
  });
  const token = data.access_token ?? data.token;
  if (!data.url || !token) throw new Error("WOPI session response was missing its url or token.");
  return {
    wopi_src: data.url,
    token,
    expires_at: data.expires_at,
    access_token_ttl: data.access_token_ttl ?? new Date(data.expires_at).getTime(),
  };
};
