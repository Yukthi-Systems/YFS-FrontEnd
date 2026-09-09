import { apiRequest } from "./apiClient";

// ---------------------------------------------------------------------------
// File operations against YFS-Main-API's /files scope.
//
//   POST /files/operations     body: FileOperationEntry[] (1..100)  -> FileOperationResult[]
//   PATCH /files/update        body: FileInfoEditRequest            -> 204
//   GET  /files/info/{file_id}                                      -> FileDetails
//
// Request shapes mirror the Rust models (src/models/files_folders.rs) exactly.
// The /files/operations RESPONSE is still a stub server-side — FileOperationResult
// is the assumed shape; keep VITE_MOCK_UPLOADS on until it returns real data.
// ---------------------------------------------------------------------------

// files_folders::FileOpsType
export type FileOpsType = "Upload" | "Download" | "Delete" | "Replace";

// One row of the array POST /files/operations expects (files_folders::FileInfoRequest).
export interface FileOperationEntry {
  folder_id: string; // real folders.folder_id UUID
  file_name: string;
  file_info: Record<string, unknown>; // UI metadata (colour, icon, …); {} if none
  file_type: string; // MIME, e.g. "text/plain"
  file_version: number; // 1 for a new file/overwrite, next version for a new revision
  expected_file_size: number; // bytes
  file_ops_type: FileOpsType;
}

// Assumed row of the parallel response array. ALIGN with the Rust handler when it
// returns a body; only this interface + the mock should need to change.
export interface FileOperationResult {
  file_name: string;
  folder_id: string;
  file_id: string; // logical files.file_id (stable across versions)
  file_version: number; // authoritative version the server assigned
  upload_url: string; // TUS creation endpoint, or a pre-signed PUT URL
  upload_protocol: "tus" | "put";
  file_location: string; // file_versions.file_location
  expires_at: string; // RFC3339
}

// files_folders::FileInfoEditRequest
export interface FileInfoEdit {
  file_id: string;
  file_name: string;
  file_info: Record<string, unknown>;
}

// The most this endpoint accepts in one call (routes/files.rs).
export const FILE_OPS_BATCH_SIZE = 100;

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// POST /files/operations — returns one result per entry, in request order. Chunks
// large folder uploads so no request carries more than the server's cap.
export const fileOperations = async (
  accessToken: string,
  entries: FileOperationEntry[]
): Promise<FileOperationResult[]> => {
  const results: FileOperationResult[] = [];
  for (const batch of chunk(entries, FILE_OPS_BATCH_SIZE)) {
    const { data } = await apiRequest<FileOperationResult[]>("/files/operations", {
      accessToken,
      method: "POST",
      body: JSON.stringify(batch),
    });
    results.push(...(data ?? []));
  }
  return results;
};

// PATCH /files/update — rename / edit a file's UI metadata (not its bytes).
export const updateFileInfo = async (accessToken: string, edit: FileInfoEdit): Promise<void> => {
  await apiRequest("/files/update", {
    accessToken,
    method: "PATCH",
    parseJson: false,
    body: JSON.stringify(edit),
  });
};

// GET /files/info/{file_id} — file details + version history. Response shape is a
// server-side stub for now.
export const getFileInfo = async (accessToken: string, fileId: string): Promise<unknown> => {
  const { data } = await apiRequest<unknown>(`/files/info/${fileId}`, { accessToken });
  return data;
};
