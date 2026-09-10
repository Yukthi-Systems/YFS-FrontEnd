// Shapes returned by YFS-Main-API (https://yfs-api.test.yukthi.net).
// Field names mirror the Rust API's JSON exactly (snake_case).

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

// Extra identity fields the SSO service hands back to the login popup in its
// SSO_AUTH_SUCCESS message. The YFS API does not carry these, so they only exist
// for the lifetime of a browser session (see AuthContext).
export interface SsoProfile {
  first_name?: string;
  last_name?: string;
  phone?: string;
  two_factor_methods?: string[];
}

// Result of POST /auth/login and POST /auth/refresh.
// `refresh_token` only comes back from /auth/login (via the X-Refresh-ID-Token header);
// /auth/refresh keeps the same refresh token, so it's optional here.
export interface AuthPayload {
  access_token: string;
  refresh_token?: string;
  expires_in?: number; // seconds, from X-Session-Expiry
  user_info: BackendUserInfo;
  sso_profile?: SsoProfile; // only populated straight after the SSO popup
}

// One row from GET /folders/list/root and GET /folders/list/under/{id}.
// The API returns both folders and files in a single list, discriminated by
// `is_resource_folder`.
export interface BackendResource {
  is_resource_folder: boolean;
  parent_folder_id: string | null;
  resource_id: string;
  resource_name: string;
  resource_info: Record<string, unknown> | null;
  total_resource_size: number;
  created_at: string; // RFC3339
  updated_at: string; // RFC3339
  deleted_at: string; // RFC3339 (sentinel timestamp when not deleted)
}

export interface PageQuery {
  limit: number;
  offset: number;
}

// Default page size for every paginated GET endpoint. The web UI pages through
// results with infinite scroll, one PAGE_SIZE-sized window at a time.
export const PAGE_SIZE = 100;

// GET /user/user-by-id/{id} and one row of GET /user/search/user-by-email/{email}.
// Only users who have signed in to YFS at least once exist here.
export interface BasicUserInfo {
  user_id: string;
  email: string;
  domain_name: string;
  // Per-user settings blob visible to the whole organization (name, avatar, …).
  public_info: Record<string, unknown>;
  // Per-user settings blob visible only to the user themselves (UI preferences).
  // null on any user that isn't the caller (user-by-id), and {} from search.
  private_info: Record<string, unknown> | null;
  last_seen_at: string; // RFC3339
}

// The five per-user permissions on an internal folder share.
export interface InternalSharePermissions {
  can_preview: boolean;
  can_download: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

// One row from GET /share/internal/list/sharing-in and /sharing-out.
// sharing-in: `user_id` is the folder owner. sharing-out: one row per owned folder
// that has at least one share, `user_id` is the most-recent recipient and the
// permissions are that share's (use getFolderShareInfo for the full per-user list).
export interface InternalSharedResource extends InternalSharePermissions {
  is_resource_folder: boolean;
  user_id: string;
  resource_id: string;
  resource_name: string;
  resource_info: Record<string, unknown> | null;
  total_resource_size: number;
  created_at: string; // RFC3339
  updated_at: string; // RFC3339
}

// One row from GET /share/internal/info/sharing-out/{folder_id} — every user a
// folder is shared with, with their permissions.
export interface FolderShareInfo extends InternalSharePermissions {
  folder_id: string;
  shared_with_user_id: string;
}
