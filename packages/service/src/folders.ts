import { apiRequest } from "./apiClient";
import { PAGE_SIZE } from "./types";
import type { BackendResource, PageQuery } from "./types";

// The structured payload the frontend keeps inside folders.folder_info /
// files.file_info (the API stores it verbatim as JSONB and echoes it back as
// BackendResource.resource_info). Unknown keys — UI colour/icon and the like — are
// preserved whenever the frontend rewrites this on an edit.
export interface FolderCreationInfo {
  user_id?: string;
  // No user_name here by design — the creator's display name is resolved live from
  // user_id via GET /user/user-by-id (public_info.display_name) instead of stamped
  // once at creation, so it doesn't go stale when the creator renames themselves.
  // No created_at/parent_folder_id either — both duplicate fields the resource
  // already carries at the top level (BackendResource.created_at/.parent_folder_id),
  // so there's nothing here to read that isn't already available there.
  // Older resources created before this change may still carry user_name/
  // created_at/parent_folder_id keys in their stored JSON; they're simply ignored
  // now (ResourceInfo's index signature still accepts them, nothing breaks parsing).
}

// Presence (true) means "in trash". No metadata beyond that: restoring always goes
// through an explicit destination picker now rather than auto-returning to
// trashed_from, and modifiedAt already captures when a trashed item was last
// touched (i.e. when it was trashed) — so there's nothing else worth stamping here.
// Older resources created before this change may still carry an object with
// trashed_from/trashed_at/etc.; any truthy value here still reads as "trashed".
export type TrashInfo = boolean;

// Per-item UI preferences (Drive-style): folder colour, folder icon. Server-backed
// so they follow the user across devices. Starred is NOT here — see
// atoms/userSettings.ts's starredIdsAtom: starring is personal, per-user state, so
// it lives in the user's own private_info instead of on the shared resource.
export interface ResourceUiInfo {
  color?: string; // CSS colour, e.g. "#e8710a"
  icon?: string; // key from the frontend's fixed folder-icon set
}

export interface ResourceInfo {
  creation_info?: FolderCreationInfo;
  trash_info?: TrashInfo | null;
  ui?: ResourceUiInfo;
  [key: string]: unknown;
}

// Default page size for every list endpoint. The UI pages through with infinite
// scroll, requesting the next `limit`-sized window as the user nears the end.
const DEFAULT_PAGE: PageQuery = { limit: PAGE_SIZE, offset: 0 };

const pageParams = (page: Partial<PageQuery> = {}): string => {
  const { limit, offset } = { ...DEFAULT_PAGE, ...page };
  return `?limit=${limit}&offset=${offset}`;
};

// GET /folders/list/root — top-level folders (and files) for the signed-in user.
export const listRootFolders = async (
  accessToken: string,
  page?: Partial<PageQuery>
): Promise<BackendResource[]> => {
  const { data } = await apiRequest<BackendResource[]>(`/folders/list/root${pageParams(page)}`, { accessToken });
  return data ?? [];
};

// GET /folders/list/under/{parentFolderId} — direct children of a folder.
export const listFolderChildren = async (
  accessToken: string,
  parentFolderId: string,
  page?: Partial<PageQuery>
): Promise<BackendResource[]> => {
  const { data } = await apiRequest<BackendResource[]>(
    `/folders/list/under/${parentFolderId}${pageParams(page)}`,
    { accessToken }
  );
  return data ?? [];
};

// The owning user is taken from the session now, not the body. `sharedFolderId` is
// only set when the target folder lives inside a "Shared with me" folder — the API
// then checks the caller's share permissions and writes as the folder's owner.
type SharedFolderScope = { sharedFolderId?: string | null };

// POST /folders/create — the API doesn't echo the new folder back, callers should
// re-list the parent afterwards to pick it up. For a shared-folder target both
// parentFolderId and sharedFolderId are required.
export const createFolder = async (
  accessToken: string,
  params: {
    parentFolderId: string | null;
    folderName: string;
    folderInfo?: Record<string, unknown>;
  } & SharedFolderScope
): Promise<void> => {
  await apiRequest("/folders/create", {
    accessToken,
    method: "POST",
    parseJson: false,
    body: JSON.stringify({
      parent_folder_id: params.parentFolderId,
      shared_folder_id: params.sharedFolderId ?? null,
      folder_name: params.folderName,
      folder_info: params.folderInfo ?? {},
    }),
  });
};

// PATCH /folders/edit — rename / update metadata.
export const editFolder = async (
  accessToken: string,
  params: {
    folderId: string;
    folderName: string;
    folderInfo?: Record<string, unknown>;
  } & SharedFolderScope
): Promise<void> => {
  await apiRequest("/folders/edit", {
    accessToken,
    method: "PATCH",
    parseJson: false,
    body: JSON.stringify({
      folder_id: params.folderId,
      shared_folder_id: params.sharedFolderId ?? null,
      folder_name: params.folderName,
      folder_info: params.folderInfo ?? {},
    }),
  });
};

// DELETE /folders/delete — permanently deletes a folder and everything under it.
// folder_name/folder_info are written first (same as editFolder — worth passing the
// current values, not placeholders, since they land in the same row update), then the
// server marks the whole subtree deleted_at immediately and purges it (storage bytes,
// file_versions/files/folders rows, quota) in a background task — this returns 202
// Accepted once the delete is queued, not once it's actually finished.
export const deleteFolder = async (
  accessToken: string,
  params: {
    folderId: string;
    folderName: string;
    folderInfo?: Record<string, unknown>;
  } & SharedFolderScope
): Promise<void> => {
  await apiRequest("/folders/delete", {
    accessToken,
    method: "DELETE",
    parseJson: false,
    body: JSON.stringify({
      folder_id: params.folderId,
      shared_folder_id: params.sharedFolderId ?? null,
      folder_name: params.folderName,
      folder_info: params.folderInfo ?? {},
    }),
  });
};

// PUT /folders/move — re-parent a folder (null = move to root).
export const moveFolder = async (
  accessToken: string,
  params: { folderId: string; newParentFolderId: string | null } & SharedFolderScope
): Promise<void> => {
  await apiRequest("/folders/move", {
    accessToken,
    method: "PUT",
    parseJson: false,
    body: JSON.stringify({
      folder_id: params.folderId,
      new_parent_folder_id: params.newParentFolderId,
      shared_folder_id: params.sharedFolderId ?? null,
    }),
  });
};
