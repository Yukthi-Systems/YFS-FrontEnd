import * as tus from "tus-js-client";
import { fileOperations, type FileOperationEntry, type FileOperationResult } from "@yfs/service";
import { putBlob } from "./blobStore";

// One place that talks to the upload backend: get an upload URL (POST /files/operations)
// then push the bytes. Swap MockUploadClient -> TusUploadClient (or flip
// VITE_MOCK_UPLOADS) once the /files/operations handler returns a real body.
export interface UploadClient {
  requestUpload(token: string, entries: FileOperationEntry[]): Promise<FileOperationResult[]>;
  upload(
    file: File,
    target: FileOperationResult,
    onProgress: (pct: number) => void,
    signal?: AbortSignal
  ): Promise<void>;
}

// Keep the uploaded bytes in IndexedDB too, so previews work instantly instead of
// waiting on a real download endpoint (which doesn't exist yet). storageKey =
// file_location, which is what FileSystemContext hydrates from.
const cacheLocally = (location: string, file: File) =>
  putBlob(location, file).catch((err) => console.warn("Local blob cache failed", err));

// ---------------------------------------------------------------------------
// Mock: no network. Synthesises upload URLs and simulates the transfer so the
// whole enqueue -> request -> upload -> re-list flow runs end to end.
// ---------------------------------------------------------------------------
const TICK_MS = 80;
const BYTES_PER_MS = 6000; // simulated transfer rate
const MIN_MS = 200;
const MAX_MS = 3000;

// Stable pseudo-id per folder+name so re-uploading the same file keeps its file_id
// (mirrors the real backend's one-row-per-folder+name rule).
const mockFileId = (folderId: string, name: string): string => {
  let h = 0;
  const s = `${folderId}/${name.toLowerCase()}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `mock-${(h >>> 0).toString(16).padStart(8, "0")}`;
};

export class MockUploadClient implements UploadClient {
  async requestUpload(_token: string, entries: FileOperationEntry[]): Promise<FileOperationResult[]> {
    return entries.map((e) => {
      const fileId = mockFileId(e.folder_id, e.file_name);
      const location = `mock/${fileId}/v${e.file_version}`;
      return {
        file_name: e.file_name,
        folder_id: e.folder_id,
        file_id: fileId,
        file_version: e.file_version,
        upload_url: `mock://${location}`,
        upload_protocol: "put" as const,
        file_location: location,
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      };
    });
  }

  async upload(
    file: File,
    target: FileOperationResult,
    onProgress: (pct: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const duration = Math.min(MAX_MS, Math.max(MIN_MS, file.size / BYTES_PER_MS));
    const startedAt = Date.now();

    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (signal?.aborted) {
          reject(new DOMException("Upload cancelled", "AbortError"));
          return;
        }
        const elapsed = Date.now() - startedAt;
        onProgress(Math.min(99, Math.round((elapsed / duration) * 99)));
        if (elapsed >= duration) {
          resolve();
          return;
        }
        setTimeout(tick, TICK_MS);
      };
      tick();
    });

    await cacheLocally(target.file_location, file);
    onProgress(100);
  }
}

// ---------------------------------------------------------------------------
// Real: upload URL from YFS-Main-API, bytes via TUS (resumable) or a plain
// pre-signed PUT.
// ---------------------------------------------------------------------------
const TUS_RETRY_DELAYS = [0, 1000, 3000, 5000, 10000];

const putWithProgress = (
  url: string,
  file: File,
  onProgress: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
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

export class TusUploadClient implements UploadClient {
  requestUpload(token: string, entries: FileOperationEntry[]): Promise<FileOperationResult[]> {
    return fileOperations(token, entries);
  }

  async upload(
    file: File,
    target: FileOperationResult,
    onProgress: (pct: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (target.upload_protocol === "tus") {
      await uploadViaTus(file, target, onProgress, signal);
    } else {
      await putWithProgress(target.upload_url, file, onProgress, signal);
    }
    await cacheLocally(target.file_location, file);
  }
}

// Default to the mock until /files/operations returns a real body. Set
// VITE_MOCK_UPLOADS=false to use the real upload-URL + TUS path.
export const uploadsAreMocked = import.meta.env.VITE_MOCK_UPLOADS !== "false";

export const createUploadClient = (): UploadClient =>
  uploadsAreMocked ? new MockUploadClient() : new TusUploadClient();
