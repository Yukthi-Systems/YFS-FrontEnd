import { apiRequest } from "./apiClient";

// File upload against YFS-Main-API's /files scope.
//
//   POST /files/upload   body: FileOpsRequest (one file)  -> UploadSession[] (always
//                         exactly one element — YFS-Main-API relays the Storage API's
//                         /sessions/upload response verbatim, which is array-shaped
//                         because it also serves batched internal callers)
//
// This is upload-only for now — Download/Delete/Replace, batching, and shared-folder
// targets aren't wired up server-side yet (see routes/files.rs and
// models/files_folders.rs; shared_folder_id is accepted but unused by the handler).
// Request/response shapes mirror the Rust (files_folders::FileOpsRequest) and Go
// (models.UploadSession) structs — don't invent fields either side doesn't have,
// notably there's no file_location or upload_protocol in the response.

export interface FileUploadRequest {
  folder_id: string; // real folders.folder_id UUID (the immediate parent)
  file_id?: string | null; // omit for a brand-new file; required for file_version > 1
  shared_folder_id?: string | null; // accepted but not yet acted on server-side
  file_name: string;
  file_info: Record<string, unknown>; // UI metadata (colour, icon, …); {} if none
  file_type: string; // MIME, e.g. "text/plain"
  file_version: number; // 1 for a new file; otherwise must be exactly latest + 1
  expected_file_size: number; // bytes
}

// models.UploadSession (YFS-Files-Api) — one issued upload slot for exactly one file.
export interface UploadSession {
  file_name: string;
  expected_file_size: number;
  token: string; // opaque Storage-API session token — sent as `Authorization: Bearer` to tus
  file_id: string; // logical files.file_id (stable across versions)
  file_version: number;
  folder_id: string;
  owner_id: string;
  expires_at: string; // RFC3339
  base_url: string; // Storage API origin — the tus endpoint is `${base_url}/upload/tus/`
}

// POST /files/upload — one file per call.
export const requestFileUpload = async (accessToken: string, req: FileUploadRequest): Promise<UploadSession> => {
  const { data } = await apiRequest<UploadSession[]>("/files/upload", {
    accessToken,
    method: "POST",
    body: JSON.stringify(req),
  });
  const session = data?.[0];
  if (!session) throw new Error("Upload session response was empty");
  return session;
};

// files_folders::FileInfoEditRequest
export interface FileInfoEdit {
  file_id: string;
  file_name: string;
  file_info: Record<string, unknown>;
}

// PATCH /files/update — rename / edit a file's UI metadata (not its bytes). Not
// currently mounted server-side (routes/files.rs has it commented out) — calling
// this will 404 until that lands.
export const updateFileInfo = async (accessToken: string, edit: FileInfoEdit): Promise<void> => {
  await apiRequest("/files/update", {
    accessToken,
    method: "PATCH",
    parseJson: false,
    body: JSON.stringify(edit),
  });
};

// GET /files/info/{file_id} — file details + version history. Not currently mounted
// server-side either (see above).
export const getFileInfo = async (accessToken: string, fileId: string): Promise<unknown> => {
  const { data } = await apiRequest<unknown>(`/files/info/${fileId}`, { accessToken });
  return data;
};
