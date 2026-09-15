import type { FileItem } from "../types/file";

// One file about to be uploaded, with its folder chain already resolved to a real id.
export interface PlannedUpload {
  file: File;
  fileName: string; // sanitized leaf name
  targetFolderId: string; // real folders.folder_id (the immediate parent)
  // Set when targetFolderId is inside a "Shared with me" subtree: the id of the
  // folder actually shared with the user (the shared-subtree root). null otherwise.
  sharedFolderId: string | null;
}

export type UploadBlockReason = "shared-folder" | "needs-versioning";

export interface UploadStep {
  plan: PlannedUpload;
  fileId: string | null; // set when this is a new version of an existing file
  fileVersion: number;
}

const DEFAULT_MIME = "application/octet-stream";

// Decides whether POST /files/upload can currently handle this planned upload, and
// with what file_id/file_version — it's upload-only right now, so:
//   - new name                     -> allowed, file_version 1
//   - existing name, versioning ON -> allowed, file_version = existing + 1
//   - existing name, versioning OFF -> blocked (server has no in-place replace yet)
//   - target inside a shared folder -> blocked (server ignores shared_folder_id today)
export const resolveUploadStep = (
  plan: PlannedUpload,
  existingFiles: FileItem[],
  versioningEnabled: boolean
): { step: UploadStep } | { blocked: UploadBlockReason } => {
  // if (plan.sharedFolderId !== null) return { blocked: "shared-folder" };

  const existing = existingFiles.find(
    (f) => !f.isFolder && !f.isDeleted && f.parentId === plan.targetFolderId && f.name === plan.fileName
  );
  if (!existing) return { step: { plan, fileId: null, fileVersion: 1 } };
  if (!versioningEnabled || !existing.fileId) return { blocked: "needs-versioning" };

  return { step: { plan, fileId: existing.fileId, fileVersion: (existing.version ?? 1) + 1 } };
};

export const uploadBlockMessage = (reason: UploadBlockReason): string =>
  reason === "shared-folder"
    ? "Uploading into shared folders isn't supported yet"
    : "A file with this name already exists — enable file versioning to upload a new version";

export const fileTypeOf = (file: File): string => file.type || DEFAULT_MIME;

// Cap concurrent uploads so a big folder drop doesn't open hundreds of sockets.
export const UPLOAD_CONCURRENCY = 4;

// Run `worker` over every item, at most `limit` in flight at once. Never rejects —
// per-item failures are the worker's own concern (it updates task state).
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
