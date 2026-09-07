import { apiRequest } from "./apiClient";
import type { BasicUserInfo } from "./types";

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
export const getUserById = async (accessToken: string, userId: string): Promise<BasicUserInfo | null> => {
  const { data } = await apiRequest<BasicUserInfo | null>(`/user/user-by-id/${userId}`, { accessToken });
  return data ?? null;
};
