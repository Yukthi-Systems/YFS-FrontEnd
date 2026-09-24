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
import type {
  BackendResource,
  FolderShareInfo,
  InternalSharedResource,
  InternalSharePermissions,
  PageQuery,
} from "./types";

// Keep in step with folders.ts — the UI pages through shared folders the same way.
const DEFAULT_PAGE: PageQuery = { limit: PAGE_SIZE, offset: 0 };

const pageParams = (page: Partial<PageQuery> = {}): string => {
  const { limit, offset } = { ...DEFAULT_PAGE, ...page };
  return `?limit=${limit}&offset=${offset}`;
};

// GET /share/internal/list/sharing-in — folders other users have shared WITH me.
export const listSharingIn = async (
  accessToken: string,
  page?: Partial<PageQuery>
): Promise<InternalSharedResource[]> => {
  const { data } = await apiRequest<InternalSharedResource[]>(
    `/share/internal/list/sharing-in${pageParams(page)}`,
    { accessToken }
  );
  return data ?? [];
};

// GET /share/internal/list/sharing-out — one row per recipient.
export const listSharingOut = async (
  accessToken: string,
  page?: Partial<PageQuery>
): Promise<InternalSharedResource[]> => {
  const { data } = await apiRequest<InternalSharedResource[]>(
    `/share/internal/list/sharing-out${pageParams(page)}`,
    { accessToken }
  );
  return data ?? [];
};

// GET /share/internal/list/under/{sharedFolderId}/{requestFolderId} — `sharedFolderId` is the share root from listSharingIn.
export const listSharedFolderChildren = async (
  accessToken: string,
  sharedFolderId: string,
  requestFolderId: string,
  page?: Partial<PageQuery>
): Promise<BackendResource[]> => {
  const { data } = await apiRequest<BackendResource[]>(
    `/share/internal/list/under/${sharedFolderId}/${requestFolderId}${pageParams(page)}`,
    { accessToken }
  );
  return data ?? [];
};

// GET /share/internal/info/sharing-out/{folderId} — every recipient with their permissions.
export const getFolderShareInfo = async (
  accessToken: string,
  folderId: string
): Promise<FolderShareInfo[]> => {
  const { data } = await apiRequest<FolderShareInfo[]>(
    `/share/internal/info/sharing-out/${folderId}`,
    { accessToken }
  );
  return data ?? [];
};

// POST /share/internal/create — 403 if sharing is disabled for the org.
export const createInternalShare = async (
  accessToken: string,
  params: { folderId: string; sharedWithUserId: string; permissions: InternalSharePermissions }
): Promise<void> => {
  await apiRequest("/share/internal/create", {
    accessToken,
    method: "POST",
    parseJson: false,
    body: JSON.stringify({
      folder_id: params.folderId,
      shared_with_user_id: params.sharedWithUserId,
      ...params.permissions,
    }),
  });
};

// PATCH /share/internal/update — change the permissions on an existing share.
export const updateInternalShare = async (
  accessToken: string,
  params: { folderId: string; sharedWithUserId: string; permissions: InternalSharePermissions }
): Promise<void> => {
  await apiRequest("/share/internal/update", {
    accessToken,
    method: "PATCH",
    parseJson: false,
    body: JSON.stringify({
      folder_id: params.folderId,
      shared_with_user_id: params.sharedWithUserId,
      ...params.permissions,
    }),
  });
};

// DELETE /share/internal/delete/{folder_id}/{shared_with_user_id} — revoke a share.
export const deleteInternalShare = async (
  accessToken: string,
  folderId: string,
  sharedWithUserId: string
): Promise<void> => {
  await apiRequest(`/share/internal/delete/${folderId}/${sharedWithUserId}`, {
    accessToken,
    method: "DELETE",
    parseJson: false,
  });
};
