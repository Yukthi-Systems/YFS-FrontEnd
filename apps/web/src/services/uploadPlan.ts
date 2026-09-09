import type { FileOperationEntry } from "@yfs/service";
import type { FileItem } from "../types/file";

// One file about to be uploaded, with its folder chain already resolved to a real id.
export interface PlannedUpload {
  file: File;
  fileName: string; // sanitized leaf name
  targetFolderId: string; // real folders.folder_id
}

const DEFAULT_MIME = "application/octet-stream";
const key = (folderId: string, name: string) => `${folderId} ${name.toLowerCase()}`;

// Build the JSON array for POST /files/operations, one entry per planned upload in
// the same order.
//
// Version + op resolution:
//   - new name                    -> "Upload",  file_version 1
//   - existing name, versioning ON -> "Upload",  file_version = highest known + 1
//   - existing name, versioning OFF -> "Replace", file_version 1 (overwrites content;
//     the backend's UNIQUE(folder_id, file_name) keeps it one row)
// "Known" spans both what's already in the folder and earlier files in this same
// batch, so re-uploading a folder with two same-named files bumps the second again.
export const buildFileOperations = (
  uploads: PlannedUpload[],
  existingFiles: FileItem[],
  versioningEnabled: boolean
): FileOperationEntry[] => {
  const maxVersion = new Map<string, number>();
  for (const f of existingFiles) {
    if (f.isFolder || f.isDeleted) continue;
    const k = key(f.parentId ?? "", f.name); // "" == the user's root, matches ROOT_FOLDER_ID
    const v = f.version ?? 1;
    if (v > (maxVersion.get(k) ?? 0)) maxVersion.set(k, v);
  }

  return uploads.map(({ file, fileName, targetFolderId }) => {
    const k = key(targetFolderId, fileName);
    const exists = maxVersion.has(k);

    let file_version = 1;
    let file_ops_type: FileOperationEntry["file_ops_type"] = "Upload";
    if (exists && versioningEnabled) {
      file_version = (maxVersion.get(k) ?? 0) + 1;
      maxVersion.set(k, file_version);
    } else if (exists) {
      file_ops_type = "Replace";
    }

    return {
      folder_id: targetFolderId,
      file_name: fileName,
      file_info: {},
      file_type: file.type || DEFAULT_MIME,
      file_version,
      expected_file_size: file.size,
      file_ops_type,
    };
  });
};

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
