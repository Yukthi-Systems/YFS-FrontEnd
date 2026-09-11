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

const TUS_RETRY_DELAYS = [0, 1000, 3000, 5000, 10000];

// Keep the uploaded bytes in IndexedDB too, so previews work instantly instead of
// waiting on a real download endpoint (which doesn't exist yet). The upload session
// response has no storage key for us to reuse, so we mint our own.
const cacheLocally = async (file: File): Promise<string> => {
  const storageKey = generateStorageKey();
  await putBlob(storageKey, file).catch((err) => console.warn("Local blob cache failed", err));
  return storageKey;
};

const uploadViaTus = (
  file: File,
  session: UploadSession,
  onProgress: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> =>
  new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${session.base_url.replace(/\/$/, "")}${TUS_BASE_PATH}`,
      // The Storage API authorizes every tus request (POST create + HEAD/PATCH/
      // DELETE) with this per-file bearer token, not X-API-Token.
      headers: session.token ? { Authorization: `Bearer ${session.token}` } : undefined,
      retryDelays: TUS_RETRY_DELAYS,
      // Same file dropped again resumes rather than restarts.
      fingerprint: async () =>
        `yfs-${session.file_id}-v${session.file_version}-${file.size}-${file.lastModified}`,
      metadata: {
        filename: session.file_name,
        filetype: file.type || "application/octet-stream",
        fileId: session.file_id,
        fileVersion: String(session.file_version),
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
  // POST /files/upload — one file per call; see @yfs/service files.ts for why.
  requestUpload(token: string, req: FileUploadRequest): Promise<UploadSession> {
    return requestFileUpload(token, req);
  },

  async upload(
    file: File,
    session: UploadSession,
    onProgress: (pct: number) => void,
    signal?: AbortSignal
  ): Promise<{ storageKey: string }> {
    await uploadViaTus(file, session, onProgress, signal);
    const storageKey = await cacheLocally(file);
    return { storageKey };
  },
};

export type UploadClient = typeof uploadClient;
