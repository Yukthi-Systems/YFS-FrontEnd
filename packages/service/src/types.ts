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

// Shapes returned by YFS-Main-API; field names match its JSON (snake_case).

export interface BackendUserInfo {
  email: string;
  user_id: string;
  domain_name: string;
  organization_id: string;
  organization_name: string;
  is_file_versioning_enabled: boolean;
  is_sharing_enabled: boolean;
  quota_allocated: number; // GB
  quota_utilized: number; // GB
}

// Extra identity from the SSO popup; not stored by the API.
export interface SsoProfile {
  first_name?: string;
  last_name?: string;
  phone?: string;
  two_factor_methods?: string[];
}

// POST /auth/login and /auth/refresh. Only login returns `refresh_token`.
export interface AuthPayload {
  access_token: string;
  refresh_token?: string;
  expires_in?: number; // seconds, from X-Session-Expiry
  user_info: BackendUserInfo;
  sso_profile?: SsoProfile; // only populated straight after the SSO popup
}

// A folder or file row, discriminated by `is_resource_folder`.
export interface BackendResource {
  is_resource_folder: boolean;
  parent_folder_id: string | null;
  resource_id: string;
  resource_name: string;
  resource_info: Record<string, unknown> | null;
  total_resource_size: number;
  created_at: string; // RFC3339
  updated_at: string; // RFC3339
  deleted_at: string;
  is_locked?: boolean;
}

export interface PageQuery {
  limit: number;
  offset: number;
}

export const PAGE_SIZE = 50;

// Only users who have signed in to YFS at least once exist.
export interface BasicUserInfo {
  user_id: string;
  email: string;
  domain_name: string;
  // Visible to the whole organization (name, avatar, …).
  public_info: Record<string, unknown>;
  // Visible only to the user; null for other users, {} from search.
  private_info: Record<string, unknown> | null;
  last_seen_at: string; // RFC3339
}

export interface UserQuota {
  used_storage_bytes: number;
  used_file_count: number;
}

export interface InternalSharePermissions {
  can_preview: boolean;
  can_download: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

// sharing-in: `user_id` is the owner. sharing-out: one row per folder with the latest recipient.
export interface InternalSharedResource {
  is_resource_folder: boolean;
  user_id: string;
  resource_id: string;
  resource_name: string;
  resource_info: Record<string, unknown> | null;
  total_resource_size: number;
  permission_set: InternalSharePermissions;
  created_at: string; // RFC3339
  updated_at: string; // RFC3339
  is_locked?: boolean;
}

export interface FolderShareInfo extends InternalSharePermissions {
  folder_id: string;
  shared_with_user_id: string;
}
