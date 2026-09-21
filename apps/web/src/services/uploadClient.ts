import * as tus from "tus-js-client";
import { requestFileUpload, type FileUploadRequest, type UploadSession } from "@yfs/service";
import { generateStorageKey, putBlob } from "./blobStore";

// Talks to the real upload backend: ask YFS-Main-API for a per-file upload session
// (POST /files/upload -> token + storage API base_url), then push the bytes to the
// Storage API over tus (resumable). The Storage API confirms the committed version
// back to YFS-Main-API through a server-side callback, so there's no confirm step
// here.

// The Storage API's tus mount point — not returned in the session response, so this
// has to match YFS-Files-Api's TUS_BASE_PATH config (defaults to this value; would
// need updating here if that default ever changes).
const TUS_BASE_PATH = "/upload/tus/";

// Storage API origin used when the upload session comes back without a usable base_url.
// The Storage API derives base_url from the "<host>;<path>" prefix of file_location, so a
// Main-API that sends the host separately (hosted_at) leaves it empty — and an empty
// base_url makes the tus endpoint a relative URL that hits the app's own origin (404).
const STORAGE_FALLBACK_URL = import.meta.env.VITE_STORAGE_URL || "https://storage.your-domain.tld";

const TUS_RETRY_DELAYS = [0, 1000, 2000, 3000, 5000, 10000, 15000, 30000, 60000];

// Send the file as a series of 100MB PATCH requests instead of tus-js-client's default
// (one request for the whole file, chunkSize: Infinity) — bounds how much a flaky
// connection has to redo per fault, and gives pause/resume a real chunk boundary to
// stop at instead of aborting mid-stream. tusd (the Go backend's tus server) already
// persists bytes incrementally as PATCHes arrive, so this needed no backend change.
const CHUNK_SIZE = 100 * 1024 * 1024;

// Keep the uploaded bytes in IndexedDB too, so previews work instantly instead of
// waiting on a real download endpoint (which doesn't exist yet). The upload session
// response has no storage key for us to reuse, so we mint our own.
const cacheLocally = async (file: File): Promise<string> => {
  const storageKey = generateStorageKey();
  await putBlob(storageKey, file).catch((err) => console.warn("Local blob cache failed", err));
  return storageKey;
};

export interface UploadHandle {
  // Stops sending without terminating the upload server-side — tus keeps the
  // partially-received bytes, so resume() continues from the last acked chunk
  // instead of restarting.
  pause: () => void;
  resume: () => void;
  // Aborts in flight *and* tells the Storage API to discard what's been received so
  // far (DELETE), unlike pause.
  cancel: () => void;
  // Settles once: resolves on success, rejects on error or cancel. Stays pending
  // across any number of pause/resume cycles.
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
    // The Storage API authorizes every tus request (POST create + HEAD/PATCH/
    // DELETE) with this per-file bearer token, not X-API-Token.
    headers: session.token ? { Authorization: `Bearer ${session.token}` } : undefined,
    chunkSize: CHUNK_SIZE,
    retryDelays: TUS_RETRY_DELAYS,
    // Automatically flag reconnecting status when tus encounters transient network errors
    onShouldRetry: (err) => {
      const status = err.originalResponse ? err.originalResponse.getStatus() : 0;
      // Do not retry on permanent 4xx client errors (401, 403, 404, etc.)
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        return false;
      }
      onStatusChange("reconnecting");
      return true;
    },
    // Same file dropped again resumes rather than restarts.
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
      // A pause aborts the in-flight chunk too — tus-js-client's abort() doesn't
      // itself invoke onError, but guard anyway since we settle explicitly on cancel.
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
  // POST /files/upload — one file per call; see @yfs/service files.ts for why.
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
