import { apiRequest } from "./apiClient";
import { PAGE_SIZE } from "./types";
import type { InternalSharePermissions, PageQuery } from "./types";

// External (public-link) shares. Unlike internal shares, these can target a single
// file OR a folder, and are reached without a YFS account via a public session.
// Mirrors src/models/files_folders.rs and src/routes/shares.rs.

// One external share as returned by GET /share/external/list.
export interface ExternalShare extends InternalSharePermissions {
  share_id: string; // caller-chosen, 3–36 chars, used in the /share/<id> URL
  created_by: string;
  share_file_target_id: string | null;
  share_folder_target_id: string | null;
  share_info: Record<string, unknown>; // UI notes etc.
  password_hash: string | null; // presence = password-protected (never the raw value)
  phones_for_otp: string[];
  emails_for_otp: string[];
  expires_at: string | null; // RFC3339
  created_at: string; // RFC3339
}

export interface CreateExternalShareInput {
  shareId: string;
  fileTargetId?: string | null;
  folderTargetId?: string | null;
  permissions: InternalSharePermissions;
  shareInfo?: Record<string, unknown>;
  rawPassword?: string | null;
  phonesForOtp?: string[];
  emailsForOtp?: string[];
  expiresAt?: string | null; // RFC3339
}

export interface UpdateExternalShareInput {
  permissions: InternalSharePermissions;
  shareInfo?: Record<string, unknown>;
  // Only touches the password when true: raw string sets it, null clears it.
  updatePassword?: boolean;
  rawPassword?: string | null;
  phonesForOtp?: string[];
  emailsForOtp?: string[];
  expiresAt?: string | null;
}

const DEFAULT_PAGE: PageQuery = { limit: PAGE_SIZE, offset: 0 };
const pageParams = (page: Partial<PageQuery> = {}): string => {
  const { limit, offset } = { ...DEFAULT_PAGE, ...page };
  return `?limit=${limit}&offset=${offset}`;
};

// POST /share/external/create — 400 if the share id isn't 3–36 chars or neither
// target is given.
export const createExternalShare = async (
  accessToken: string,
  input: CreateExternalShareInput
): Promise<void> => {
  await apiRequest("/share/external/create", {
    accessToken,
    method: "POST",
    parseJson: false,
    body: JSON.stringify({
      share_id: input.shareId,
      share_file_target_id: input.fileTargetId ?? null,
      share_folder_target_id: input.folderTargetId ?? null,
      ...input.permissions,
      share_info: input.shareInfo ?? {},
      raw_password: input.rawPassword ?? null,
      phones_for_otp: input.phonesForOtp ?? [],
      emails_for_otp: input.emailsForOtp ?? [],
      expires_at: input.expiresAt ?? null,
    }),
  });
};

// PATCH /share/external/update/{shareId}
export const updateExternalShare = async (
  accessToken: string,
  shareId: string,
  input: UpdateExternalShareInput
): Promise<void> => {
  await apiRequest(`/share/external/update/${encodeURIComponent(shareId)}`, {
    accessToken,
    method: "PATCH",
    parseJson: false,
    body: JSON.stringify({
      ...input.permissions,
      share_info: input.shareInfo ?? {},
      update_password_hash: input.updatePassword ?? false,
      raw_password: input.rawPassword ?? null,
      phones_for_otp: input.phonesForOtp ?? [],
      emails_for_otp: input.emailsForOtp ?? [],
      expires_at: input.expiresAt ?? null,
    }),
  });
};

// DELETE /share/external/delete/{shareId}
export const deleteExternalShare = async (accessToken: string, shareId: string): Promise<void> => {
  await apiRequest(`/share/external/delete/${encodeURIComponent(shareId)}`, {
    accessToken,
    method: "DELETE",
    parseJson: false,
  });
};

// GET /share/external/list — every external share I've created, newest first.
export const listExternalShares = async (
  accessToken: string,
  page?: Partial<PageQuery>
): Promise<ExternalShare[]> => {
  const { data } = await apiRequest<ExternalShare[]>(`/share/external/list${pageParams(page)}`, {
    accessToken,
  });
  return data ?? [];
};
