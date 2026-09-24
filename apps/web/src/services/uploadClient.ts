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

import * as tus from "tus-js-client";
import { readEnv, requestFileUpload, type FileUploadRequest, type UploadSession } from "@yfs/service";
import { generateStorageKey, putBlob } from "./blobStore";

// Gets an upload session from YFS-Main-API, then sends the bytes to the Storage API over tus.

// Must match YFS-Files-Api's TUS_BASE_PATH.
const TUS_BASE_PATH = "/upload/tus/";

// Used when the session's base_url is empty; otherwise tus would hit the app's own origin.
const STORAGE_FALLBACK_URL = readEnv("VITE_STORAGE_URL");

const TUS_RETRY_DELAYS = [0, 1000, 2000, 3000, 5000, 10000, 15000, 30000, 60000];

// 100MB chunks bound retries on a flaky connection and give pause a real boundary.
const CHUNK_SIZE = 100 * 1024 * 1024;

// Cache bytes in IndexedDB for instant previews.
const cacheLocally = async (file: File): Promise<string> => {
  const storageKey = generateStorageKey();
  await putBlob(storageKey, file).catch((err) => console.warn("Local blob cache failed", err));
  return storageKey;
};

export interface UploadHandle {
  // Keeps received bytes server-side; resume() continues from the last acked chunk.
  pause: () => void;
  resume: () => void;
  // Also tells the Storage API to discard received bytes.
  cancel: () => void;
  // Settles once; stays pending across pause/resume.
  promise: Promise<void>;
}

const startTusUpload = (
  file: File,
  session: UploadSession,
  onProgress: (pct: number) => void,
  onStatusChange: (status: "uploading" | "paused" | "reconnecting") => void
): UploadHandle => {
  let settled = false;
  let resolveFn!: () => void;
  let rejectFn!: (err: unknown) => void;
  const promise = new Promise<void>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const upload = new tus.Upload(file, {
    endpoint: `${(session.base_url || STORAGE_FALLBACK_URL).replace(/\/$/, "")}${TUS_BASE_PATH}`,
    headers: session.token ? { Authorization: `Bearer ${session.token}` } : undefined,
    chunkSize: CHUNK_SIZE,
    retryDelays: TUS_RETRY_DELAYS,
    onShouldRetry: (err) => {
      const status = err.originalResponse ? err.originalResponse.getStatus() : 0;
      // Don't retry permanent 4xx errors.
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        return false;
      }
      onStatusChange("reconnecting");
      return true;
    },
    fingerprint: async () =>
      `yfs-${session.file_id}-v${session.file_version}-${file.size}-${file.lastModified}`,
    metadata: {
      filename: session.file_name,
      filetype: file.type || "application/octet-stream",
      fileId: session.file_id,
      fileVersion: String(session.file_version),
    },
    onProgress: (sent, total) => {
      onStatusChange("uploading");
      onProgress(Math.round((sent / total) * 100));
    },
    onError: (err) => {
      if (settled) return;
      settled = true;
      rejectFn(err);
    },
    onSuccess: () => {
      if (settled) return;
      settled = true;
      resolveFn();
    },
  });

  upload.findPreviousUploads().then((prev) => {
    if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
    upload.start();
  });

  return {
    pause: () => {
      onStatusChange("paused");
      upload.abort(false).catch(() => {});
    },
    resume: () => {
      onStatusChange("uploading");
      upload.start();
    },
    cancel: () => {
      if (settled) return;
      settled = true;
      upload.abort(true).finally(() => rejectFn(new DOMException("Upload cancelled", "AbortError")));
    },
    promise,
  };
};

export const uploadClient = {
  requestUpload(token: string, req: FileUploadRequest): Promise<UploadSession> {
    return requestFileUpload(token, req);
  },

  startUpload(
    file: File,
    session: UploadSession,
    onProgress: (pct: number) => void,
    onStatusChange: (status: "uploading" | "paused" | "reconnecting") => void
  ): UploadHandle {
    return startTusUpload(file, session, onProgress, onStatusChange);
  },

  cacheLocally,
};

export type UploadClient = typeof uploadClient;
