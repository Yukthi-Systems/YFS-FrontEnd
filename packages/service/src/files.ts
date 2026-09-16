import { apiRequest } from "./apiClient";

// File upload/download against YFS-Main-API's /files scope.
//
//   POST /files/upload    body: FileOpsRequest (one file)  -> UploadSession[] (always
//                          exactly one element — YFS-Main-API relays the Storage API's
//                          /sessions/upload response verbatim, which is array-shaped
//                          because it also serves batched internal callers)
//   POST /files/download  body: FileOpsRequest (one file)  -> DownloadSession[] (same
//                          array-of-one relay as upload, confirmed against a live
//                          response 2026-09-12 — the array-vs-object mismatch flagged
//                          earlier is fixed backend-side)
//
// Delete/Replace, batching, and shared-folder upload targets aren't wired up
// server-side yet (see routes/files.rs and models/files_folders.rs; shared_folder_id
// is accepted but unused by the upload handler). Request/response shapes mirror the
// Rust (files_folders::FileOpsRequest) and Go (models.UploadSession /
// models.DownloadSession) structs — don't invent fields either side doesn't have.

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

// FileOpsRequest — same body shape as upload/download. PATCH /files/update actually
// deserializes into the full FileOpsRequest server-side (routes/files.rs
// update_file_info), so folder_id/file_type/file_version/expected_file_size are
// required even though only file_name and file_info get written — this narrower
// shape will fail to deserialize until the update-file work extends it.
export interface FileInfoEdit {
  folder_id: string;
  file_id: string;
  shared_folder_id?: string | null;
  file_name: string;
  file_info: Record<string, unknown>;
  file_type: string;
  file_version: number;
  expected_file_size: number;
}

// PATCH /files/update — rename / edit a file's UI metadata (not its bytes). Mounted
// server-side now, but see FileInfoEdit above — the request body sent today is
// missing fields the handler requires.
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

// Same FileOpsRequest shape as FileUploadRequest — file_id is required (not optional)
// since a download always targets an existing file/version.
export interface FileDownloadRequest {
  folder_id: string;
  file_id: string;
  shared_folder_id?: string | null;
  file_name: string;
  file_info: Record<string, unknown>;
  file_type: string;
  file_version: number;
  expected_file_size: number;
}

// One issued download slot for exactly one file — mirrors UploadSession's shape.
// `url` already carries the token as a `?token=` query param, good for one GET
// against the Storage API (e.g. straight into an <a>/<img>/<video> src, or fetch()
// with an `Authorization: Bearer <token>` header — either works).
export interface DownloadSession {
  file_name: string;
  file_id: string;
  file_version: number;
  folder_id: string;
  owner_id: string;
  token: string;
  url: string;
  expires_at: string; // RFC3339
}

// POST /files/download — one file per call, mirrors /files/upload (including the
// array-of-one response shape).
export const requestFileDownload = async (accessToken: string, req: FileDownloadRequest): Promise<DownloadSession> => {
  const { data } = await apiRequest<DownloadSession[]>("/files/download", {
    accessToken,
    method: "POST",
    body: JSON.stringify(req),
  });
  const session = data?.[0];
  if (!session) throw new Error("Download session response was empty");
  return session;
};

// Same FileOpsRequest shape as FileUploadRequest/FileDownloadRequest — folder_id is
// the file's *current* parent (not the destination), required for the source-side
// permission check. destinationFolderId is a required path segment server-side
// (routes/files.rs move_file), so moving a file to root isn't representable against
// this endpoint at all — there's no way to pass "no parent" for a file move.
export interface FileMoveRequest {
  folder_id: string;
  file_id: string;
  shared_folder_id?: string | null;
  file_name: string;
  file_info: Record<string, unknown>;
  file_type: string;
  file_version: number;
  expected_file_size: number;
}

// PUT /files/move/{destination_folder_id}
export const moveFile = async (
  accessToken: string,
  destinationFolderId: string,
  req: FileMoveRequest
): Promise<void> => {
  await apiRequest(`/files/move/${destinationFolderId}`, {
    accessToken,
    method: "PUT",
    parseJson: false,
    body: JSON.stringify(req),
  });
};
