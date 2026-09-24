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

import type { FileItem } from "../types/file";
import { getFileBasicInfo, type FileDownloadRequest } from "@yfs/service";
import { fileTypeGuess } from "./fileSystemStore";

// One file about to be uploaded, with its folder chain already resolved to a real id.
export interface PlannedUpload {
  file: File;
  fileName: string; // sanitized leaf name
  targetFolderId: string; // immediate parent folder id
  // Share root id when the target is inside "Shared with me"; null otherwise.
  sharedFolderId: string | null;
}

export type UploadBlockReason = "shared-folder" | "needs-versioning";

export interface UploadStep {
  plan: PlannedUpload;
  fileId: string | null;
  fileVersion: number;
}

const DEFAULT_MIME = "application/octet-stream";

// New name → version 1; existing name with versioning → latest + 1; otherwise blocked.
export const resolveUploadStep = async (
  plan: PlannedUpload,
  existingFiles: FileItem[],
  versioningEnabled: boolean,
  accessToken: string
): Promise<{ step: UploadStep } | { blocked: UploadBlockReason }> => {

  const existing = existingFiles.find(
    (f) => !f.isFolder && !f.isDeleted && f.parentId === plan.targetFolderId && f.name === plan.fileName
  );
  if (!existing) return { step: { plan, fileId: null, fileVersion: 1 } };
  if (!versioningEnabled || !existing.fileId || !existing.parentId) return { blocked: "needs-versioning" };

  // Listings carry no version, so ask the server instead of trusting local state.
  const infoReq: FileDownloadRequest = {
    folder_id: existing.parentId,
    file_id: existing.fileId,
    file_name: existing.name,
    file_info: existing.resourceInfo ?? {},
    file_type: fileTypeGuess(existing),
    file_version: 1,
    expected_file_size: existing.size,
  };
  const info = await getFileBasicInfo(accessToken, infoReq);
  const latestVersion = info.available_versions.length ? Math.max(...info.available_versions) : 0;

  return { step: { plan, fileId: existing.fileId, fileVersion: latestVersion + 1 } };
};

export const uploadBlockMessage = (reason: UploadBlockReason): string =>
  reason === "shared-folder"
    ? "Uploading into shared folders isn't supported yet"
    : "A file with this name already exists — enable file versioning to upload a new version";

export const fileTypeOf = (file: File): string => file.type || DEFAULT_MIME;

// Cap concurrent uploads so a big folder drop doesn't open hundreds of sockets.
export const UPLOAD_CONCURRENCY = 6;

// At most `limit` in flight; never rejects.
export const runPool = async <T,>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> => {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
};
