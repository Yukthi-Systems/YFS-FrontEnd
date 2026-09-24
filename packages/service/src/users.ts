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
import { HttpError } from "./http";
import type { BasicUserInfo, UserQuota } from "./types";

// GET /user/search/user-by-email/{email} — up to 10 org users who have signed in before.
export const searchUsersByEmail = async (accessToken: string, email: string): Promise<BasicUserInfo[]> => {
  const query = email.trim();
  if (!query) return [];
  const { data } = await apiRequest<BasicUserInfo[]>(
    `/user/search/user-by-email/${encodeURIComponent(query)}`,
    { accessToken }
  );
  return data ?? [];
};

// GET /user/user-by-id/{id} — `private_info` only for the caller; 404 resolves to null.
export const getUserById = async (accessToken: string, userId: string): Promise<BasicUserInfo | null> => {
  try {
    const { data } = await apiRequest<BasicUserInfo | null>(`/user/user-by-id/${userId}`, { accessToken });
    return data ?? null;
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
};

// PATCH /user/update-user-info/{isPublic} — replaces the blob wholesale; merge before calling.
export const updateUserInfo = async (
  accessToken: string,
  scope: "public" | "private",
  info: Record<string, unknown>
): Promise<void> => {
  await apiRequest(`/user/update-user-info/${scope === "public"}`, {
    accessToken,
    method: "PATCH",
    parseJson: false,
    body: JSON.stringify(info),
  });
};

// GET /user/quota — the cached used_storage_bytes/used_file_count row, cheap.
export const getMyQuota = async (accessToken: string): Promise<UserQuota> => {
  const { data } = await apiRequest<UserQuota>("/user/quota", { accessToken });
  return data;
};

export const refreshMyQuota = async (accessToken: string): Promise<UserQuota> => {
  const { data } = await apiRequest<UserQuota>("/user/quota/refresh", {
    accessToken,
    method: "PATCH",
  });
  return data;
};
