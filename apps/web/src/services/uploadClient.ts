import { generateStorageKey, putBlob } from "./blobStore";

export interface UploadResult {
  storageKey: string;
  size: number;
}

// Swap point for a real backend: implement this same interface with tus-js-client against
// a real TUS endpoint (real chunked/resumable progress instead of the simulated timer
// below) and swap the instance created in UploadQueueContext — no caller changes needed.
export interface UploadClient {
  upload(file: File, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<UploadResult>;
}

const TICK_MS = 80;
const BYTES_PER_MS = 4000; // simulated transfer rate
const MIN_DURATION_MS = 250;
const MAX_DURATION_MS = 3500;

export class MockUploadClient implements UploadClient {
  async upload(file: File, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<UploadResult> {
    const duration = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, file.size / BYTES_PER_MS));
    const startedAt = Date.now();

    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (signal?.aborted) {
          reject(new DOMException("Upload cancelled", "AbortError"));
          return;
        }
        const elapsed = Date.now() - startedAt;
        const pct = Math.min(95, Math.round((elapsed / duration) * 95));
        onProgress(pct);
        if (elapsed >= duration) {
          resolve();
          return;
        }
        setTimeout(tick, TICK_MS);
      };
      tick();
    });

    if (signal?.aborted) {
      throw new DOMException("Upload cancelled", "AbortError");
    }

    const storageKey = generateStorageKey();
    await putBlob(storageKey, file);
    onProgress(100);

    return { storageKey, size: file.size };
  }
}
