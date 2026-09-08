import { apiRequest } from "./apiClient";
import { PAGE_SIZE } from "./types";
import type { BackendResource, PageQuery } from "./types";

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

// POST /folders/create — the API doesn't echo the new folder back, callers should
// re-list the parent afterwards to pick it up.
export const createFolder = async (
  accessToken: string,
  params: {
    userId: string;
    parentFolderId: string | null;
    folderName: string;
    folderInfo?: Record<string, unknown>;
  }
): Promise<void> => {
  await apiRequest("/folders/create", {
    accessToken,
    method: "POST",
    parseJson: false,
    body: JSON.stringify({
      user_id: params.userId,
      parent_folder_id: params.parentFolderId,
      folder_name: params.folderName,
      folder_info: params.folderInfo ?? {},
    }),
  });
};

// PATCH /folders/edit — rename / update metadata.
export const editFolder = async (
  accessToken: string,
  params: {
    userId: string;
    folderId: string;
    folderName: string;
    folderInfo?: Record<string, unknown>;
  }
): Promise<void> => {
  await apiRequest("/folders/edit", {
    accessToken,
    method: "PATCH",
    parseJson: false,
    body: JSON.stringify({
      user_id: params.userId,
      folder_id: params.folderId,
      folder_name: params.folderName,
      folder_info: params.folderInfo ?? {},
    }),
  });
};

// PUT /folders/move — re-parent a folder (null = move to root).
export const moveFolder = async (
  accessToken: string,
  params: { userId: string; folderId: string; newParentFolderId: string | null }
): Promise<void> => {
  await apiRequest("/folders/move", {
    accessToken,
    method: "PUT",
    parseJson: false,
    body: JSON.stringify({
      user_id: params.userId,
      folder_id: params.folderId,
      new_parent_folder_id: params.newParentFolderId,
    }),
  });
};
