import { apiRequest } from "./apiClient";
import { PAGE_SIZE } from "./types";
import type { BackendResource, PageQuery } from "./types";

// Anonymous access to an external share (the /share/<share_id> page). No YFS
// account — a short-lived public session (Redis, ~3h) stands in for one.
// Mirrors src/routes/auth.rs (/public/*), src/routes/shares.rs and
// src/middleware/auth.rs. The session token rides in the x-public-session-id
// header on every call after createPublicSession.
//
// NOTE: folder shares can now be browsed (GET /public/folders/list/under/{id}).
// There is still no public endpoint to download a file or fetch a single-file
// share, so file shares can only show metadata.

const PUBLIC_HEADER = "x-public-session-id";

export interface PublicSession {
  public_session_token: string; // send back as the x-public-session-id header
  share_info: Record<string, unknown>;
  is_password_protected: boolean;
  is_email_otp_protected: boolean;
  is_phone_otp_protected: boolean;
  is_file_share: boolean; // true = the share targets a file, false = a folder
  expires_at: string | null; // RFC3339
}

// POST /public/session/{share_id} — mint a session for a share. If the share has
// no restrictions the session is already active; otherwise validate below first.
// 400 if the share doesn't exist or has expired.
export const createPublicSession = async (shareId: string): Promise<PublicSession> => {
  const { data } = await apiRequest<PublicSession>(`/public/session/${encodeURIComponent(shareId)}`, {
    method: "POST",
  });
  return data;
};

// POST /public/validate/password — check the visitor's password and activate the
// session. Keep using the same token afterwards (the server re-keys it in place).
// 400 on a wrong password or an expired / unrestricted share.
export const validatePublicSessionPassword = async (
  publicSessionToken: string,
  rawPassword: string
): Promise<void> => {
  await apiRequest("/public/validate/password", {
    method: "POST",
    parseJson: false,
    headers: { [PUBLIC_HEADER]: publicSessionToken },
    body: JSON.stringify(rawPassword), // handler takes a bare JSON string
  });
};

// One external share's targets + the visitor's permissions on it.
export interface PublicSessionInfo {
  share_id: string;
  created_by: string;
  share_folder_target_id: string | null;
  share_file_target_id: string | null;
  can_preview: boolean;
  can_download: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

// GET /public/session — details for the active session. 401 until the session is
// active (i.e. after the password step for a protected share).
export const getPublicSession = async (publicSessionToken: string): Promise<PublicSessionInfo> => {
  const { data } = await apiRequest<PublicSessionInfo>("/public/session", {
    headers: { [PUBLIC_HEADER]: publicSessionToken },
  });
  return data;
};

// DELETE /public/logout — end the session.
export const publicLogout = async (publicSessionToken: string): Promise<void> => {
  await apiRequest("/public/logout", {
    method: "DELETE",
    parseJson: false,
    headers: { [PUBLIC_HEADER]: publicSessionToken },
  });
};

const DEFAULT_PAGE: PageQuery = { limit: PAGE_SIZE, offset: 0 };
const pageParams = (page: Partial<PageQuery> = {}): string => {
  const { limit, offset } = { ...DEFAULT_PAGE, ...page };
  return `?limit=${limit}&offset=${offset}`;
};

// GET /public/folders/list/under/{requestFolderId} — direct children of a folder
// inside a shared-folder link. `requestFolderId` must be the share target or a
// folder under it. Only valid for folder shares.
export const listPublicFolderChildren = async (
  publicSessionToken: string,
  requestFolderId: string,
  page?: Partial<PageQuery>
): Promise<BackendResource[]> => {
  const { data } = await apiRequest<BackendResource[]>(
    `/public/folders/list/under/${requestFolderId}${pageParams(page)}`,
    { headers: { [PUBLIC_HEADER]: publicSessionToken } }
  );
  return data ?? [];
};

// POST /public/folders/create — create a folder inside a shared-folder link.
// `parentFolderId` must be the share target or a folder under it. The API doesn't
// echo the folder back — re-list the parent afterwards. Gate on the session's
// can_create in the UI; the endpoint itself doesn't check it.
export const createPublicFolder = async (
  publicSessionToken: string,
  params: { parentFolderId: string; folderName: string; folderInfo?: Record<string, unknown> }
): Promise<void> => {
  await apiRequest("/public/folders/create", {
    method: "POST",
    parseJson: false,
    headers: { [PUBLIC_HEADER]: publicSessionToken },
    body: JSON.stringify({
      parent_folder_id: params.parentFolderId,
      shared_folder_id: null,
      folder_name: params.folderName,
      folder_info: params.folderInfo ?? {},
    }),
  });
};

// PATCH /public/folders/edit — rename / update a folder inside a shared-folder
// link. Requires the session's can_update.
export const editPublicFolder = async (
  publicSessionToken: string,
  params: { folderId: string; folderName: string; folderInfo?: Record<string, unknown> }
): Promise<void> => {
  await apiRequest("/public/folders/edit", {
    method: "PATCH",
    parseJson: false,
    headers: { [PUBLIC_HEADER]: publicSessionToken },
    body: JSON.stringify({
      folder_id: params.folderId,
      shared_folder_id: null,
      folder_name: params.folderName,
      folder_info: params.folderInfo ?? {},
    }),
  });
};

// PUT /public/folders/move — re-parent a folder inside a shared-folder link. Both
// the folder and the new parent must be under the share. Requires can_create AND
// can_update.
export const movePublicFolder = async (
  publicSessionToken: string,
  params: { folderId: string; newParentFolderId: string }
): Promise<void> => {
  await apiRequest("/public/folders/move", {
    method: "PUT",
    parseJson: false,
    headers: { [PUBLIC_HEADER]: publicSessionToken },
    body: JSON.stringify({
      folder_id: params.folderId,
      new_parent_folder_id: params.newParentFolderId,
      shared_folder_id: null,
    }),
  });
};
