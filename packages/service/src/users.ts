import { apiRequest } from "./apiClient";
import { HttpError } from "./http";
import type { BasicUserInfo, UserQuota } from "./types";

// GET /user/search/user-by-email/{email} — up to 10 same-organization users whose
// email contains the query. Used to pick a share recipient. Only returns users who
// have signed in to YFS before.
export const searchUsersByEmail = async (accessToken: string, email: string): Promise<BasicUserInfo[]> => {
  const query = email.trim();
  if (!query) return [];
  const { data } = await apiRequest<BasicUserInfo[]>(
    `/user/search/user-by-email/${encodeURIComponent(query)}`,
    { accessToken }
  );
  return data ?? [];
};

// GET /user/user-by-id/{user_id} — resolve a single user (e.g. a share's owner/recipient).
// `private_info` comes back only when the id is the caller's own; it's null otherwise.
// 404 (no such user in this org, or never signed in) resolves to null.
export const getUserById = async (accessToken: string, userId: string): Promise<BasicUserInfo | null> => {
  try {
    const { data } = await apiRequest<BasicUserInfo | null>(`/user/user-by-id/${userId}`, { accessToken });
    return data ?? null;
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
};

// PATCH /user/update-user-info/{isPublic} — replace this user's public_info (visible
// to the org) or private_info (visible only to them) blob wholesale. The body is the
// full JSON object; merge client-side before calling if you're only changing a key.
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
