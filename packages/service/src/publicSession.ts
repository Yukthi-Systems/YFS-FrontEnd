/*
 * Copyright (C) 2026 Yukthi Systems Private Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * version 3 along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */

import { apiRequest } from "./apiClient";
import { PAGE_SIZE } from "./types";
import type { BackendResource, InternalSharePermissions, PageQuery } from "./types";

// Anonymous access to external shares (/share/<id>). The session token goes in x-public-session-id.

const PUBLIC_HEADER = "x-public-session-id";

export interface PublicSession {
  public_session_token: string; // send back as the x-public-session-id header
  share_info: Record<string, unknown>;
  is_password_protected: boolean;
  is_email_otp_protected: boolean;
  is_phone_otp_protected: boolean;
  is_file_share: boolean;
  expires_at: string | null; // RFC3339
}

// POST /public/session/{share_id} — already active unless the share is protected; 400 if missing or expired.
export const createPublicSession = async (shareId: string): Promise<PublicSession> => {
  const { data } = await apiRequest<PublicSession>(`/public/session/${encodeURIComponent(shareId)}`, {
    method: "POST",
  });
  return data;
};

// POST /public/validate/password — activates the session; keep using the same token.
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

export interface PublicSessionInfo {
  share_id: string;
  created_by: string;
  share_folder_target_id: string | null;
  share_file_target_id: string | null;
  permission_set: InternalSharePermissions;
}

// GET /public/session — 401 until the session is active.
export const getPublicSession = async (publicSessionToken: string): Promise<PublicSessionInfo> => {
  const { data } = await apiRequest<PublicSessionInfo>("/public/session", {
    headers: { [PUBLIC_HEADER]: publicSessionToken },
  });
  return data;
};

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

// Stands in for creation_info when an anonymous visitor creates a folder.
export interface AnonymousFolderCreationInfo {
  anonymous: true;
  created_via_share_id: string; // the external share the visitor came through
  parent_folder_id: string;
  created_at: string; // RFC3339
}

export const buildAnonymousCreationInfo = (
  shareId: string,
  parentFolderId: string
): { creation_info: AnonymousFolderCreationInfo } => ({
  creation_info: {
    anonymous: true,
    created_via_share_id: shareId,
    parent_folder_id: parentFolderId,
    created_at: new Date().toISOString(),
  },
});

// GET /share/public/folders/list/under/{id} — folder shares only.
export const listPublicFolderChildren = async (
  publicSessionToken: string,
  requestFolderId: string,
  page?: Partial<PageQuery>
): Promise<BackendResource[]> => {
  const { data } = await apiRequest<BackendResource[]>(
    `/share/public/folders/list/under/${requestFolderId}${pageParams(page)}`,
    { headers: { [PUBLIC_HEADER]: publicSessionToken } }
  );
  return data ?? [];
};

// POST /share/public/folders/create — no echo; re-list the parent. The endpoint doesn't check can_create.
export const createPublicFolder = async (
  publicSessionToken: string,
  params: {
    parentFolderId: string;
    folderName: string;
    shareId: string;
    folderInfo?: Record<string, unknown>;
  }
): Promise<void> => {
  await apiRequest("/share/public/folders/create", {
    method: "POST",
    parseJson: false,
    headers: { [PUBLIC_HEADER]: publicSessionToken },
    body: JSON.stringify({
      parent_folder_id: params.parentFolderId,
      shared_folder_id: null,
      folder_name: params.folderName,
      folder_info: {
        ...buildAnonymousCreationInfo(params.shareId, params.parentFolderId),
        ...(params.folderInfo ?? {}),
      },
    }),
  });
};

// PATCH /share/public/folders/edit — requires can_update.
export const editPublicFolder = async (
  publicSessionToken: string,
  params: { folderId: string; folderName: string; folderInfo?: Record<string, unknown> }
): Promise<void> => {
  await apiRequest("/share/public/folders/edit", {
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

// PUT /share/public/folders/move — requires can_create and can_update.
export const movePublicFolder = async (
  publicSessionToken: string,
  params: { folderId: string; newParentFolderId: string }
): Promise<void> => {
  await apiRequest("/share/public/folders/move", {
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
