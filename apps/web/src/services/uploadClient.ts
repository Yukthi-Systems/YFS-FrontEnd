import * as tus from "tus-js-client";
import { fileOperations, type FileOperationEntry, type FileOperationResult } from "@yfs/service";
import { putBlob } from "./blobStore";

// Talks to the real upload backend: ask YFS-Main-API for a per-file upload session
// (POST /files/operations -> token + tus endpoint), then push the bytes to the
// Storage API — resumable via tus, or a plain pre-signed PUT if the server says so.
// The Storage API confirms the committed version back to YFS-Main-API through a
// server-side callback, so there's no confirm step here.

// Keep the uploaded bytes in IndexedDB too, so previews work instantly instead of
// waiting on a real download endpoint (which doesn't exist yet). storageKey =
// file_location, which is what fileSystemStore hydrates from.
const cacheLocally = (location: string, file: File) =>
  putBlob(location, file).catch((err) => console.warn("Local blob cache failed", err));

const TUS_RETRY_DELAYS = [0, 1000, 3000, 5000, 10000];

const putWithProgress = (
  url: string,
  file: File,
  token: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`PUT failed with status ${xhr.status}`));
    xhr.onerror = () => reject(new Error("PUT failed"));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });

const uploadViaTus = (
  file: File,
  target: FileOperationResult,
  onProgress: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> =>
  new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: target.upload_url,
      // The Storage API authorizes every tus request (POST create + HEAD/PATCH/
      // DELETE) with this per-file bearer token, not X-API-Token.
      headers: target.token ? { Authorization: `Bearer ${target.token}` } : undefined,
      retryDelays: TUS_RETRY_DELAYS,
      // Same file dropped again resumes rather than restarts.
      fingerprint: async () =>
        `yfs-${target.file_id}-v${target.file_version}-${file.size}-${file.lastModified}`,
      metadata: {
        filename: target.file_name,
        filetype: file.type || "application/octet-stream",
        fileId: target.file_id,
        fileVersion: String(target.file_version),
      },
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onError: (err) => reject(err),
      onSuccess: () => resolve(),
    });
    signal?.addEventListener("abort", () => {
      upload.abort(true).finally(() => reject(new DOMException("Upload cancelled", "AbortError")));
    });
    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });

export const uploadClient = {
  // POST /files/operations — one upload session (token + endpoint) per entry.
  requestUpload(token: string, entries: FileOperationEntry[]): Promise<FileOperationResult[]> {
    return fileOperations(token, entries);
  },

  async upload(
    file: File,
    target: FileOperationResult,
    onProgress: (pct: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (target.upload_protocol === "tus") {
      await uploadViaTus(file, target, onProgress, signal);
    } else {
      await putWithProgress(target.upload_url, file, target.token, onProgress, signal);
    }
    await cacheLocally(target.file_location, file);
  },
};

export type UploadClient = typeof uploadClient;
