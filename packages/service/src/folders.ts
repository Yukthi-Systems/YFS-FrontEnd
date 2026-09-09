import { apiRequest } from "./apiClient";
import { PAGE_SIZE } from "./types";
import type { BackendResource, PageQuery } from "./types";

// The structured payload the frontend keeps inside folders.folder_info /
// files.file_info (the API stores it verbatim as JSONB and echoes it back as
// BackendResource.resource_info). Unknown keys — UI colour/icon and the like — are
// preserved whenever the frontend rewrites this on an edit.
export interface FolderCreationInfo {
  user_id?: string;
  user_name?: string;
  parent_folder_id?: string | null;
  created_at?: string; // RFC3339
}

export interface FolderTrashInfo {
  trashed_from: string | null; // the original parent_folder_id
  trashed_from_name?: string;
  trashed_by?: string; // user_id
  trashed_by_name?: string;
  trashed_at: string; // RFC3339
}

// Per-item UI preferences (Drive-style): starred, folder colour, folder icon.
// Server-backed so they follow the user across devices.
export interface ResourceUiInfo {
  starred?: boolean;
  color?: string; // CSS colour, e.g. "#e8710a"
  icon?: string; // key from the frontend's fixed folder-icon set
}

export interface ResourceInfo {
  creation_info?: FolderCreationInfo;
  trash_info?: FolderTrashInfo | null;
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
