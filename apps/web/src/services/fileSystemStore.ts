import { getDefaultStore } from "jotai";
import type { FileItem, FileVersion, ShareSettings } from "../types/file";
import { SHARED_ROOT_ID } from "../types/file";
import type {
  BackendResource,
  InternalSharedResource,
  InternalSharePermissions,
  ResourceInfo,
  ResourceUiInfo,
  UpdateExternalShareInput,
} from "@yfs/service";
import {
  HttpError,
  PAGE_SIZE,
  listRootFolders,
  listFolderChildren,
  createFolder as apiCreateFolder,
  editFolder as apiEditFolder,
  moveFolder as apiMoveFolder,
  deleteFolder as apiDeleteFolder,
  listSharingIn,
  listSharingOut,
  listSharedFolderChildren,
  listExternalShares,
  deleteExternalShare,
  updateExternalShare,
  updateFileInfo as apiUpdateFileInfo,
  moveFile as apiMoveFile,
  deleteFile as apiDeleteFile,
  deleteFileVersion as apiDeleteFileVersion,
  getUserById,
} from "@yfs/service";
import { sanitizeName, categorizeByName } from "../utils/fileType";
import { isItemLocked } from "../utils/format";
import { generateStorageKey, getBlob, putBlob } from "../services/blobStore";
import { queryClient } from "../lib/queryClient";
import { showToast } from "../atoms/toast";
import { starredIdsAtom, setStoredStarredIds } from "../atoms/userSettings";
import {
  filesAtom,
  isLoadingAtom,
  remoteErrorAtom,
  pageInfoAtom,
  trashFolderIdAtom,
  sharedOutAtom,
  sharedOutLoadingAtom,
  sharedOutLoadedAtom,
  sharedLinksAtom,
  sharedLinksLoadingAtom,
  sharedLinksLoadedAtom,
  type AddFileInput,
} from "../atoms/fileSystem";

// Client-side file-system store: the entire tree (root + shared + trash) held as one
// flat FileItem[] in filesAtom, plus the mutation/sync logic that keeps it in step
// with YFS-Main-API. A singleton, wired to the signed-in user by
// components/FileSystemBridge.tsx; components read it via hooks/useFileSystem.ts.
// Deliberately still one flat tree rather than Query's per-resource cache — search,
// breadcrumbs and the trash view all need the whole thing at once. Reads go through
// queryClient.fetchQuery (see folderQueryKey), writes through queryClient mutations
// (see runMutation).

const store = getDefaultStore();

const STORAGE_KEY = "yfs_fs_cache";
const ROOT_KEY = "__root__";
// A real root folder that holds trashed items. Auto-created on first login.
const TRASH_FOLDER_NAME = "Trash";

// Auth/user snapshot, kept fresh by FileSystemBridge every render.
interface AuthSnapshot {
  token: string | null;
  userId: string | null;
  refreshAccessToken: () => Promise<string | null>;
}
let authSnapshot: AuthSnapshot = { token: null, userId: null, refreshAccessToken: async () => null };
let ownerEmail = "me@example.com";
let userName: string | undefined;

export function setAuthSnapshot(next: AuthSnapshot) {
  authSnapshot = next;
}

export function setUserSnapshot(email: string | undefined, name: string | undefined) {
  ownerEmail = email || "me@example.com";
  userName = name;
}

// How many rows we've pulled for each folder key and whether the server has more.
// (Caching/dedup of the actual network requests is queryClient's job now — see
// folderQueryKey below — this Map only tracks pagination bookkeeping for the UI.)
const pageState = new Map<string, { loaded: number; hasMore: boolean }>();

// Ids with an in-flight move/trash/restore API call (fired via runMutation, never
// awaited by the caller). mergeServerListing must not let a listing fetched while
// one of these is still pending clobber its optimistic parentId/isDeleted — the
// fetch can easily land before the server has processed the move, and would
// otherwise revert the local change (or, in "force" mode, drop the row outright,
// since it looks like a server-origin item the fresh listing doesn't know about).
// Cleared once the mutation settles, success or failure, so a later listing can
// reconcile normally.
const pendingSyncIds = new Set<string>();

const trackPendingSync = <T,>(id: string, promise: Promise<T>): Promise<T> => {
  pendingSyncIds.add(id);
  return promise.finally(() => pendingSyncIds.delete(id));
};

// Thrown by a page queryFn when withFreshToken couldn't get a usable token (no
// session, or a failed refresh). Distinguishes "silently abort, already handled by
// authStore" from a real fetch failure that should surface to the user.
class AuthUnavailableError extends Error {}

// One queryClient entry per (folder key, page offset) — plain queries, not
// useInfiniteQuery, since this store is a singleton with no component of its own
// to own an infinite-query observer. staleTime: Infinity means a page fetched once
// is never silently refetched; "force" mode below explicitly invalidates first.
const folderQueryKey = (key: string, offset: number) => ["folder", key, offset] as const;

const nowIso = () => new Date().toISOString();
const randomSuffix = () => Math.random().toString(36).slice(2, 10);

interface SharedSubtree {
  rootId: string; // the folder from "Shared with me" (share endpoint's shared_folder_id)
  ownerUserId: string;
  ownerEmail?: string;
  permissions: InternalSharePermissions;
}

// Walk up from `folderId` to the "Shared with me" root it belongs to (the item
// directly under SHARED_ROOT_ID). Returns that share's id + owner + permissions so a
// nested folder can be listed through the share endpoint, or null if it isn't shared.
const sharedSubtreeContext = (files: FileItem[], folderId: string): SharedSubtree | null => {
  const byId = new Map(files.map((f) => [f.id, f]));
  let cur = byId.get(folderId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (cur.parentId === SHARED_ROOT_ID) {
      return cur.sharedIn
        ? {
            rootId: cur.id,
            ownerUserId: cur.sharedIn.ownerUserId,
            ownerEmail: cur.sharedIn.ownerEmail,
            permissions: cur.sharedIn.permissions,
          }
        : null;
    }
    if (cur.origin !== "shared" || !cur.parentId) return null;
    cur = byId.get(cur.parentId);
  }
  return null;
};

// All descendant ids of a folder (recursive). Non-folders have no descendants.
const collectDescendantIds = (files: FileItem[], rootId: string): string[] => {
  const result: string[] = [];
  const queue = [rootId];
  while (queue.length) {
    const parentId = queue.shift()!;
    for (const f of files) {
      if (f.parentId === parentId) {
        result.push(f.id);
        queue.push(f.id);
      }
    }
  }
  return result;
};

// Map a raw API resource (folder or file) into the app's FileItem shape.
const mapResource = (r: BackendResource, ownerEmailForRow: string): FileItem => {
  const info = (r.resource_info ?? undefined) as ResourceInfo | undefined;
  const trash = info?.trash_info ?? null;
  const ui = info?.ui;

  const creatorName = (info?.creation_info as { user_name?: string } | undefined)?.user_name;

  const common = {
    id: r.resource_id,
    name: r.resource_name,
    parentId: r.parent_folder_id ?? null,
    size: r.total_resource_size ?? 0,
    owner: { name: "me", email: ownerEmailForRow },
    modifiedAt: r.updated_at,
    createdAt: r.created_at,
    // Starred is personal, per-user state — resolved from the user's own
    // private_info (starredIdsAtom), not from this shared resource's own data.
    isStarred: store.get(starredIdsAtom).includes(r.resource_id),
    color: ui?.color,
    icon: ui?.icon,
    createdBy: creatorName,
    isLocked: Boolean((r as { is_locked?: boolean }).is_locked ?? (info as { is_locked?: boolean } | undefined)?.is_locked),
    // trash_info in resource_info is the source of truth for "is trashed".
    isDeleted: !!trash,
    resourceInfo: info,
    origin: "server" as const,
  };

  if (r.is_resource_folder) {
    return { ...common, isFolder: true, type: "folder" };
  }

  const { type, extension } = categorizeByName(r.resource_name);
  // resource_id IS files.file_id for a file row (see get_folders_and_files /
  // get_root_folders in YFS-Main-API's database/folders.rs) — needed for any
  // per-file call (download, update, move), not just ones this tab uploaded.
  return { ...common, isFolder: false, type, extension: extension || undefined, fileId: r.resource_id };
};

// Map a "shared with me" folder or file into a FileItem parked under SHARED_ROOT_ID.
const mapSharedResource = (r: InternalSharedResource): FileItem => {
  const info = (r.resource_info ?? undefined) as ResourceInfo | undefined;
  const isFolder = r.is_resource_folder !== false;
  const { type, extension } = isFolder ? { type: "folder" as const, extension: undefined } : categorizeByName(r.resource_name);
  const trash = info?.trash_info ?? null;
  const ui = info?.ui;
  const creatorName = (info?.creation_info as { user_name?: string } | undefined)?.user_name;

  return {
    id: r.resource_id,
    name: r.resource_name,
    isFolder,
    parentId: SHARED_ROOT_ID,
    size: r.total_resource_size ?? 0,
    owner: { name: "Shared", email: "" },
    modifiedAt: r.updated_at,
    createdAt: r.created_at,
    isStarred: store.get(starredIdsAtom).includes(r.resource_id),
    color: ui?.color,
    icon: ui?.icon,
    isDeleted: !!trash,
    type,
    extension: extension || undefined,
    fileId: isFolder ? undefined : r.resource_id,
    origin: "shared",
    resourceInfo: info,
    createdBy: creatorName,
    isLocked: Boolean((r as { is_locked?: boolean }).is_locked ?? (info as { is_locked?: boolean } | undefined)?.is_locked),
    sharedIn: {
      ownerUserId: r.user_id,
      permissions: { ...r.permission_set },
    },
  };
};

const creatorIdOf = (item: FileItem): string | undefined =>
  (item.resourceInfo as ResourceInfo | undefined)?.creation_info?.user_id;

// Resolves each item's creator display name from creation_info.user_id, live, via
// public_info.display_name (falling back to the email local-part) — the same
// pattern already used to resolve a shared folder's owner below. Cached per user id
// through the query client, so the same creator seen across many pages/folders in a
// session costs one GET /user/user-by-id call, not one per item.
const resolveCreatedByNames = async (items: FileItem[]): Promise<void> => {
  const userIds = [...new Set(items.map(creatorIdOf).filter((id): id is string => !!id))];
  if (userIds.length === 0) return;
  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const user = await queryClient.fetchQuery({
          queryKey: ["userById", userId],
          queryFn: () => withFreshToken((tk) => getUserById(tk, userId)),
          staleTime: 5 * 60 * 1000,
        });
        if (!user) return;
        const displayName =
          typeof user.public_info?.display_name === "string" ? user.public_info.display_name.trim() : "";
        const name = displayName || user.email.split("@")[0];
        for (const item of items) {
          if (creatorIdOf(item) === userId) item.createdBy = name;
        }
      } catch {
        /* leave unresolved — createdBy just stays unset for this item */
      }
    })
  );
};

// Grace window for a just-created optimistic folder whose server create call may
// still be in flight. Past this, a local-only folder that a full server listing of
// its parent didn't include is treated as orphaned (nothing ever retries these).
const LOCAL_FOLDER_GRACE_MS = 30_000;

// Merge a fresh server listing of one folder into the current tree, preserving any
// client-only state (stars, trash, shares, uploaded blobs) and reconciling optimistic
// folders created offline against their now-real server ids.
const mergeServerListing = (
  prev: FileItem[],
  parentId: string | null,
  incoming: FileItem[],
  mode: "append" | "force" | "initial" = "initial"
): FileItem[] => {
  // 1. Match optimistic local rows (offline folders, just-uploaded files) to their
  //    server counterparts by kind + parent + name so the temp id is swapped for the
  //    real one instead of showing a duplicate.
  const idRemap = new Map<string, string>();
  for (const res of incoming) {
    const local = prev.find(
      (f) =>
        f.isFolder === res.isFolder &&
        f.origin !== "server" &&
        f.parentId === res.parentId &&
        f.name === res.name &&
        f.id !== res.id
    );
    if (local) idRemap.set(local.id, res.id);
  }

  let working = prev;
  if (idRemap.size) {
    working = prev
      .filter((f) => !idRemap.has(f.id)) // drop the temp folder; the server version replaces it
      .map((f) => (f.parentId && idRemap.has(f.parentId) ? { ...f, parentId: idRemap.get(f.parentId)! } : f));
  }

  const workingIds = new Set(working.map((f) => f.id));
  const incomingIds = new Set(incoming.map((f) => f.id));

  // 2. Upsert every incoming resource, keeping client-only fields on existing rows.
  //    An id with a move/trash/restore mutation still in flight keeps its optimistic
  //    fields untouched — a listing fetched mid-flight reflects the pre-move server
  //    state and would otherwise stomp the local parentId/isDeleted right back.
  const merged: FileItem[] = working.map((f) => {
    if (pendingSyncIds.has(f.id)) return f;
    const res = incoming.find((r) => r.id === f.id);
    if (!res) return f;

    return {
      ...res,
      isStarred: f.isStarred || res.isStarred || store.get(starredIdsAtom).includes(f.id),
      isDeleted: f.isFolder ? f.isDeleted || res.isDeleted : res.isDeleted,
      share: f.share,
      versions: f.versions,
      blobUrl: f.blobUrl,
      storageKey: f.storageKey,
      fileId: res.fileId ?? f.fileId,
      version: f.version,
    };
  });
  for (const res of incoming) {
    if (!workingIds.has(res.id)) merged.push(res);
  }

  // When appending or initially upserting a page, preserve other pages. Only a forced full refresh drops rows.
  if (mode !== "force") return merged;

  // 3. Drop rows that are direct children of this folder but aren't in the fresh
  //    listing:
  //    - server rows that vanished server-side (deleted elsewhere)
  //    - orphaned optimistic folders whose create never landed — nothing retries
  //      them and fetchFolderPage won't list their children, so a kept row is a
  //      permanent phantom. A just-created one (within the grace window) is spared
  //      in case its create call is still in flight.
  //    Rows carrying client-only state worth keeping (starred / trashed / shared)
  //    are never dropped, nor is one with a move/trash/restore still in flight —
  //    a fresh listing that raced ahead of that mutation is not evidence the row
  //    is really gone.
  return merged.filter((f) => {
    if (f.parentId !== parentId) return true;
    if (incomingIds.has(f.id)) return true;
    if (f.isStarred || f.isDeleted || f.share || pendingSyncIds.has(f.id)) return true;
    if (f.origin === "server") return false;
    // Optimistic folders from createFolder / ensureFolderPath carry a "folder-" id
    // (copied or offline-authored items use other schemes and stay put).
    if (f.origin === "local" && f.isFolder && f.id.startsWith("folder-")) {
      const age = Date.now() - Date.parse(f.createdAt);
      return Number.isFinite(age) && age <= LOCAL_FOLDER_GRACE_MS;
    }
    return true;
  });
};

// Exported so hooks/useFileSystem.ts can build a reactive getPagination() closed
// over its own useAtomValue(pageInfoAtom) subscription (a plain store.get() here
// wouldn't re-render callers when pagination state changes).
export const pageKeyFor = (parentId: string | null, shared?: boolean) => (shared ? SHARED_ROOT_ID : (parentId ?? ROOT_KEY));

const setPageLoading = (key: string, loading: boolean, hasMore?: boolean, loaded?: boolean) =>
  store.set(pageInfoAtom, (p) => ({
    ...p,
    [key]: {
      hasMore: hasMore ?? p[key]?.hasMore ?? true,
      loading,
      loaded: loaded ?? (loading ? p[key]?.loaded ?? false : true),
    },
  }));

const saveCache = (updated: FileItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to cache filesystem", err);
  }
};

const persist = (updated: FileItem[]) => {
  store.set(filesAtom, updated);
  saveCache(updated);
};

// FileItem.type is our own coarse category ("image", "video", "other", …), not a
// MIME type — FileOpsRequest.file_type wants an actual MIME string. We don't track
// the original one, so this is a best-guess fallback for anything not already a
// real MIME-ish category name.
export const fileTypeGuess = (item: FileItem): string => (item.type === "other" ? "application/octet-stream" : item.type);

// Metadata stamped into a new folder's folder_info, or a new file's file_info
// (echoed back as resource_info) — this is where the "Created By" column comes from
// once the item round-trips through a listing. created_at/parent_folder_id aren't
// duplicated here — the resource's own top-level created_at/parent_folder_id
// (BackendResource.created_at / .parent_folder_id) already cover both.
export const buildCreationInfo = (): ResourceInfo => ({
  creation_info: {
    user_id: authSnapshot.userId ?? undefined,
  },
});

// Runs an API call with the current token; on 401/400 refreshes once and retries.
const withFreshToken = async <T,>(fn: (token: string) => Promise<T>): Promise<T | undefined> => {
  const current = authSnapshot.token;
  if (!current) return undefined;
  try {
    return await fn(current);
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 400)) {
      const fresh = await authSnapshot.refreshAccessToken();
      if (!fresh) return undefined;
      return await fn(fresh);
    }
    throw err;
  }
};

// Fires a background write as a real queryClient mutation (the same MutationCache
// primitive useMutation is built on), fire-and-forget since callers here are plain
// functions, not components. Failures don't roll the optimistic local edit back —
// createFolder is the one exception, with its own rollback inside onError.
const runMutation = <TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  variables: TVariables,
  onError: (err: unknown) => void
) => {
  const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn, onError });
  mutation.execute(variables).catch(() => {
    // onError above already handled/logged it; swallow so this fire-and-forget
    // call doesn't produce an unhandled promise rejection.
  });
};

// Common runMutation onError: log for debugging, toast the (now backend-provided,
// see apiClient.ts) message for the user.
const notifySyncFailed = (context: string, fallback: string) => (err: unknown) => {
  console.warn(context, err);
  showToast(err instanceof Error ? err.message : fallback, "error");
};

const inFlightFolderPages = new Set<string>();

// One folder page fetch. `mode` picks the intent:
//   "initial" — first visit; a no-op if the page is already cached (staleTime: Infinity)
//   "force"   — re-fetch page 1, resetting the scroll position
//   "append"  — pull the next page for infinite scroll
const fetchFolderPage = async (parentId: string | null, mode: "initial" | "force" | "append") => {
  if (!authSnapshot.token) return;
  const key = parentId ?? ROOT_KEY;

  // A folder inside a "Shared with me" folder is listed through the share endpoint
  // as the folder's owner, not the normal listing.
  const currentFiles = store.get(filesAtom);
  const shared = parentId !== null ? sharedSubtreeContext(currentFiles, parentId) : null;

  // Client-only folders (created offline, not yet synced) have no server listing.
  // Shared-subtree folders do (via the share endpoint), so don't skip those.
  if (parentId !== null && !shared) {
    const folder = currentFiles.find((f) => f.id === parentId);
    if (folder && folder.origin !== "server") return;
  }

  const state = pageState.get(key) ?? { loaded: 0, hasMore: true };
  if (mode === "append" && !state.hasMore) return;
  if (mode === "initial" && state.loaded > 0) return;

  if (inFlightFolderPages.has(key) && mode !== "force") return;
  inFlightFolderPages.add(key);

  const offset = mode === "append" ? state.loaded : 0;
  const queryKey = folderQueryKey(key, offset);
  // Force resets to page 1 and drops every cached page for this folder, so a later
  // "append" naturally re-fetches rather than returning a stale pre-force page.
  if (mode === "force" && offset === 0) {
    await queryClient.invalidateQueries({ queryKey: ["folder", key] });
  }
  setPageLoading(key, true, state.hasMore);

  try {
    const resources = await queryClient.fetchQuery({
      queryKey,
      queryFn: async () => {
        const r = await withFreshToken((tk) =>
          parentId === null
            ? listRootFolders(tk, { limit: PAGE_SIZE, offset })
            : shared
              ? listSharedFolderChildren(tk, shared.rootId, parentId, { limit: PAGE_SIZE, offset })
              : listFolderChildren(tk, parentId, { limit: PAGE_SIZE, offset })
        );
        if (!r) throw new AuthUnavailableError();
        return r;
      },
      staleTime: Infinity,
    });

    const hasMore = resources.length === PAGE_SIZE;
    pageState.set(key, { loaded: offset + resources.length, hasMore });
    store.set(remoteErrorAtom, null);

    const inTrash = parentId !== null && parentId === store.get(trashFolderIdAtom);
    const mapped = resources.map((r) => {
      const item = mapResource(r, ownerEmail);
      // Direct children of the Trash folder are, by definition, trashed — keep
      // the flag true even for items trashed on another device.
      if (inTrash) item.isDeleted = true;
      if (shared) {
        item.origin = "shared";
        item.owner = { name: shared.ownerEmail?.split("@")[0] || "Shared", email: shared.ownerEmail || "" };
        item.sharedIn = {
          ownerUserId: shared.ownerUserId,
          ownerEmail: shared.ownerEmail,
          permissions: shared.permissions,
        };
      }
      return item;
    });
    await resolveCreatedByNames(mapped);
    store.set(filesAtom, (prev) => {
      const next = mergeServerListing(prev, parentId, mapped, mode);
      saveCache(next);
      return next;
    });
    setPageLoading(key, false, hasMore);
  } catch (err) {
    if (err instanceof AuthUnavailableError) {
      setPageLoading(key, false);
      return;
    }
    console.warn("Failed to load folder from YFS-Main-API", err);
    const message: string | null = err instanceof Error ? err.message : "Could not reach the file service";
    store.set(remoteErrorAtom, message);
    setPageLoading(key, false);
  } finally {
    inFlightFolderPages.delete(key);
  }
};

export const loadFolder = (parentId: string | null, opts?: { force?: boolean }) =>
  fetchFolderPage(parentId, opts?.force ? "force" : "initial");

export const loadMoreFolder = (parentId: string | null) => fetchFolderPage(parentId, "append");

let inFlightShared = false;

// Shared-with-me folders, paged the same way. `mode` matches fetchFolderPage.
const fetchSharedPage = async (mode: "initial" | "force" | "append") => {
  if (!authSnapshot.token) return;
  const key = SHARED_ROOT_ID;

  const state = pageState.get(key) ?? { loaded: 0, hasMore: true };
  if (mode === "append" && !state.hasMore) return;
  if (mode === "initial" && state.loaded > 0) return;

  if (inFlightShared && mode !== "force") return;
  inFlightShared = true;

  const offset = mode === "append" ? state.loaded : 0;
  const queryKey = folderQueryKey(key, offset);
  if (mode === "force" && offset === 0) {
    await queryClient.invalidateQueries({ queryKey: ["folder", key] });
  }
  setPageLoading(key, true, state.hasMore);

  try {
    const shared = await queryClient.fetchQuery({
      queryKey,
      queryFn: async () => {
        const r = await withFreshToken((tk) => listSharingIn(tk, { limit: PAGE_SIZE, offset }));
        if (!r) throw new AuthUnavailableError();
        return r;
      },
      staleTime: Infinity,
    });

    const hasMore = shared.length === PAGE_SIZE;
    pageState.set(key, { loaded: offset + shared.length, hasMore });
    store.set(remoteErrorAtom, null);

    // Resolve each owner once so the list shows who shared the folder — prefer
    // their public_info.display_name, fall back to the email local-part.
    const owners = new Map<string, { name: string; email: string }>();
    await Promise.all(
      [...new Set(shared.map((s) => s.user_id))].map(async (ownerId) => {
        try {
          const owner = await withFreshToken((tk) => getUserById(tk, ownerId));
          if (owner) {
            const displayName =
              typeof owner.public_info?.display_name === "string" ? owner.public_info.display_name.trim() : "";
            owners.set(ownerId, { name: displayName || owner.email.split("@")[0], email: owner.email });
          }
        } catch {
          /* leave unresolved */
        }
      })
    );

    // Shared-in folders are read-only leaves — no client state to preserve.
    const mapped = shared.map((s) => {
      const item = mapSharedResource(s);
      const owner = owners.get(s.user_id);
      if (owner) {
        item.owner = { name: owner.name, email: owner.email };
        if (item.sharedIn) item.sharedIn.ownerEmail = owner.email;
      }
      return item;
    });
    await resolveCreatedByNames(mapped);
    store.set(filesAtom, (prev) => {
      // "force" replaces the whole bucket; "append" and "initial" add/merge without dropping
      const kept = mode === "force" ? prev.filter((f) => f.origin !== "shared") : prev;
      const seen = new Set(kept.map((f) => f.id));
      const next = [...kept, ...mapped.filter((m) => !seen.has(m.id))];
      saveCache(next);
      return next;
    });
    setPageLoading(key, false, hasMore);
  } catch (err) {
    if (err instanceof AuthUnavailableError) {
      setPageLoading(key, false);
      return;
    }
    console.warn("Failed to load shared folders from YFS-Main-API", err);
    const message: string | null = err instanceof Error ? err.message : "Could not reach the file service";
    store.set(remoteErrorAtom, message);
    setPageLoading(key, false);
  } finally {
    inFlightShared = false;
  }
};

export const loadSharedFolders = (opts?: { force?: boolean }) => fetchSharedPage(opts?.force ? "force" : "initial");

export const loadMoreSharedFolders = () => fetchSharedPage("append");

const SHARED_OUT_QUERY_KEY = ["sharedOut"] as const;
const SHARED_LINKS_QUERY_KEY = ["sharedLinks"] as const;

// Folders I've shared out. One row per recipient, so dedupe by folder id.
export const loadSharedOut = async (opts?: { force?: boolean }) => {
  if (!authSnapshot.token) return;
  if (opts?.force) await queryClient.invalidateQueries({ queryKey: SHARED_OUT_QUERY_KEY });
  store.set(sharedOutLoadingAtom, true);
  try {
    const rows = await queryClient.fetchQuery({
      queryKey: SHARED_OUT_QUERY_KEY,
      queryFn: async () => {
        const r = await withFreshToken((tk) => listSharingOut(tk, { limit: PAGE_SIZE, offset: 0 }));
        if (!r) throw new AuthUnavailableError();
        return r;
      },
      staleTime: Infinity,
    });
    const byId = new Map<string, InternalSharedResource>();
    for (const r of rows) byId.set(r.resource_id, r);
    const sharedOutItems = [...byId.values()].map((r) => {
      const item = mapSharedResource(r);
      item.parentId = null;
      item.owner = { name: "me", email: ownerEmail };
      return item;
    });
    await resolveCreatedByNames(sharedOutItems);
    store.set(sharedOutAtom, sharedOutItems);
    store.set(sharedOutLoadedAtom, true);
    store.set(remoteErrorAtom, null);
  } catch (err) {
    if (err instanceof AuthUnavailableError) return;
    console.warn("Failed to load shared-out folders", err);
    showToast(err instanceof Error ? err.message : "Couldn't load folders you've shared", "error");
    store.set(sharedOutLoadedAtom, true);
  } finally {
    store.set(sharedOutLoadingAtom, false);
  }
};

export const loadSharedLinks = async (opts?: { force?: boolean }) => {
  if (!authSnapshot.token) return;
  if (opts?.force) await queryClient.invalidateQueries({ queryKey: SHARED_LINKS_QUERY_KEY });
  store.set(sharedLinksLoadingAtom, true);
  try {
    const rows = await queryClient.fetchQuery({
      queryKey: SHARED_LINKS_QUERY_KEY,
      queryFn: async () => {
        const r = await withFreshToken((tk) => listExternalShares(tk, { limit: PAGE_SIZE, offset: 0 }));
        if (!r) throw new AuthUnavailableError();
        return r;
      },
      staleTime: Infinity,
    });
    store.set(sharedLinksAtom, rows);
    store.set(sharedLinksLoadedAtom, true);
    store.set(remoteErrorAtom, null);
  } catch (err) {
    if (err instanceof AuthUnavailableError) return;
    console.warn("Failed to load public links", err);
    showToast(err instanceof Error ? err.message : "Couldn't load public links", "error");
    store.set(sharedLinksLoadedAtom, true);
  } finally {
    store.set(sharedLinksLoadingAtom, false);
  }
};

export const revokeSharedLink = async (shareId: string) => {
  await withFreshToken((tk) => deleteExternalShare(tk, shareId));
  store.set(sharedLinksAtom, (prev) => prev.filter((s) => s.share_id !== shareId));
};

export const updateSharedLink = async (shareId: string, input: UpdateExternalShareInput) => {
  await withFreshToken((tk) => updateExternalShare(tk, shareId, input));
  store.set(sharedLinksAtom, (prev) =>
    prev.map((s) =>
      s.share_id !== shareId
        ? s
        : {
            ...s,
            permission_set: input.permissions,
            share_info: input.shareInfo ?? s.share_info,
            // Presence-only sentinel — the real hash never lives client-side.
            password_hash: input.updatePassword ? (input.rawPassword ? "set" : null) : s.password_hash,
            phones_for_otp: input.phonesForOtp ?? [],
            emails_for_otp: input.emailsForOtp ?? [],
            expires_at: input.expiresAt ?? null,
          }
    )
  );
};

export const getSharedFolderId = (folderId: string | null): string | null =>
  folderId !== null ? (sharedSubtreeContext(store.get(filesAtom), folderId)?.rootId ?? null) : null;

export const getSharedPermissions = (itemId: string | null): InternalSharePermissions | null => {
  if (itemId === null) return null;
  const files = store.get(filesAtom);
  const item = files.find((f) => f.id === itemId);
  if (item?.sharedIn?.permissions) return item.sharedIn.permissions;
  return sharedSubtreeContext(files, itemId)?.permissions ?? null;
};

export const setItemLocked = (id: string, isLocked: boolean) => {
  store.set(filesAtom, (prev) =>
    prev.map((f) => (f.id === id ? { ...f, isLocked } : f))
  );
};

export const getDescendantIds = (id: string) => collectDescendantIds(store.get(filesAtom), id);

// Regenerate blob: URLs (which don't survive a reload) from bytes kept in IndexedDB.
const hydrateBlobs = async (items: FileItem[]): Promise<FileItem[]> => {
  const hydrateOne = async (storageKey: string | undefined): Promise<string | undefined> => {
    if (!storageKey) return undefined;
    try {
      const blob = await getBlob(storageKey);
      return blob ? URL.createObjectURL(blob) : undefined;
    } catch (err) {
      console.error("Failed to hydrate blob", err);
      return undefined;
    }
  };

  return Promise.all(
    items.map(async (item) => {
      const blobUrl = await hydrateOne(item.storageKey);
      const versions = item.versions
        ? await Promise.all(item.versions.map(async (v) => ({ ...v, blobUrl: await hydrateOne(v.storageKey) })))
        : undefined;
      return { ...item, blobUrl, versions };
    })
  );
};

// Resolve the "Trash" root folder, creating it on first login if it's missing.
const ensureTrashFolder = async (): Promise<string | null> => {
  const known = store
    .get(filesAtom)
    .find((f) => f.isFolder && f.parentId === null && f.origin === "server" && f.name === TRASH_FOLDER_NAME);
  if (known) {
    store.set(trashFolderIdAtom, known.id);
    return known.id;
  }

  if (!authSnapshot.token) return null;

  // List root first; only create if it's genuinely absent (saves a doomed create
  // call on every login after the first).
  const readRoot = async () =>
    withFreshToken((t) => listRootFolders(t, { limit: PAGE_SIZE, offset: 0 })).catch((err) => {
      console.warn("ensureTrashFolder: could not read root listing", err);
      return undefined;
    });

  let listing = await readRoot();
  if (listing && !listing.some((r) => r.is_resource_folder && r.resource_name === TRASH_FOLDER_NAME)) {
    try {
      await withFreshToken((t) =>
        apiCreateFolder(t, {
          parentFolderId: null,
          folderName: TRASH_FOLDER_NAME,
          folderInfo: buildCreationInfo(),
        })
      );
    } catch (err) {
      if (!(err instanceof HttpError)) console.warn("ensureTrashFolder: create failed", err);
    }
    listing = await readRoot();
  }

  const match = listing?.find((r) => r.is_resource_folder && r.resource_name === TRASH_FOLDER_NAME);
  if (!match) return null;

  const mapped = (listing ?? []).map((r) => mapResource(r, ownerEmail));
  await resolveCreatedByNames(mapped);
  store.set(filesAtom, (prev) => {
    const next = mergeServerListing(prev, null, mapped, "initial");
    saveCache(next);
    return next;
  });
  store.set(trashFolderIdAtom, match.resource_id);
  return match.resource_id;
};

// Clears every bucket back to signed-out defaults. Called by FileSystemBridge when
// isAuthenticated flips false.
export const resetFileSystem = () => {
  store.set(filesAtom, []);
  store.set(isLoadingAtom, false);
  store.set(trashFolderIdAtom, null);
  store.set(sharedOutAtom, []);
  store.set(sharedOutLoadingAtom, false);
  store.set(sharedOutLoadedAtom, false);
  store.set(sharedLinksAtom, []);
  store.set(sharedLinksLoadingAtom, false);
  store.set(sharedLinksLoadedAtom, false);
  // Drop every cached page too — otherwise a later login (possibly as a different
  // user) would see this session's stale, never-expiring (staleTime: Infinity) pages.
  queryClient.removeQueries({ queryKey: ["folder"] });
  queryClient.removeQueries({ queryKey: SHARED_OUT_QUERY_KEY });
  queryClient.removeQueries({ queryKey: SHARED_LINKS_QUERY_KEY });
  pageState.clear();
  store.set(pageInfoAtom, {});
};

// Boot sequence on sign-in: hydrate the cached tree, then pull the live root listing
// over it, then make sure Trash exists. `signal.cancelled` lets the caller (the
// isAuthenticated effect in FileSystemBridge) abandon a stale run if auth flips again
// mid-flight.
export const bootFileSystem = async (signal: { cancelled: boolean }) => {
  store.set(isLoadingAtom, true);

  let cached: FileItem[] = [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) cached = JSON.parse(stored);
  } catch (err) {
    console.error("Failed to read filesystem cache", err);
  }

  const hydrated = await hydrateBlobs(cached);
  if (signal.cancelled) return;
  store.set(filesAtom, hydrated);
  store.set(isLoadingAtom, false);

  // Pull the live root listing over the cached tree, then make sure Trash exists.
  await loadFolder(null, { force: true });
  if (!signal.cancelled) await ensureTrashFolder();
};

// Optimistic local create; if signed in, also create it server-side and re-sync the
// parent so the temp id is swapped for the real one.
export const createFolder = (name: string, parentId: string | null): FileItem | null => {
  const safeName = sanitizeName(name);
  if (!safeName) return null;

  const creationInfo = buildCreationInfo();
  const newFolder: FileItem = {
    id: "folder-" + Date.now() + "-" + randomSuffix(),
    name: safeName,
    isFolder: true,
    parentId,
    size: 0,
    owner: { name: "me", email: ownerEmail },
    modifiedAt: nowIso(),
    createdAt: nowIso(),
    isStarred: false,
    isDeleted: false,
    type: "folder",
    resourceInfo: creationInfo,
    createdBy: userName,
    origin: "local",
  };

  store.set(filesAtom, (prev) => {
    const updated = [...prev, newFolder];
    saveCache(updated);
    return updated;
  });

  const tk = authSnapshot.token;
  if (tk) {
    // Creating inside a "Shared with me" folder: the API needs shared_folder_id to
    // check the caller's share permissions and write as the folder's owner. It's the
    // id of the folder actually shared with the user (the shared-subtree root), not
    // the immediate parent — the two differ for a nested subfolder.
    const sharedFolderId = parentId !== null ? (sharedSubtreeContext(store.get(filesAtom), parentId)?.rootId ?? null) : null;
    runMutation(
      () =>
        withFreshToken((t) =>
          apiCreateFolder(t, {
            parentFolderId: parentId,
            folderName: safeName,
            folderInfo: creationInfo,
            sharedFolderId,
          })
        ).then(() => loadFolder(parentId, { force: true })),
      { parentId, safeName },
      (err) => {
        notifySyncFailed("Folder create did not sync to API", "Couldn't create the folder")(err);
        // Roll the optimistic row back — nothing retries local folders and
        // fetchFolderPage won't list their children, so a kept row becomes a
        // permanent phantom. Then re-list in case the create actually landed
        // (e.g. a unique-name conflict) so it reappears as a real server row.
        store.set(filesAtom, (prev) => {
          const updated = prev.filter((f) => f.id !== newFolder.id);
          saveCache(updated);
          return updated;
        });
        loadFolder(parentId, { force: true }).catch(() => {});
      }
    );
  }

  return newFolder;
};

// Resolve a folder chain to real server ids, creating missing links. See the
// FileSystemContextType doc on ensureFolderPath. Returns the deepest folder id, or
// null on failure.
export const ensureFolderPath = async (segments: string[], rootParentId: string | null): Promise<string | null> => {
  let parentId = rootParentId;

  for (const rawSegment of segments) {
    const segment = sanitizeName(rawSegment);
    if (!segment) continue;

    const known = store
      .get(filesAtom)
      .find((f) => f.isFolder && !f.isDeleted && f.parentId === parentId && f.name === segment);
    if (known?.origin === "server") {
      parentId = known.id;
      continue;
    }

    const tk = authSnapshot.token;
    if (!tk) {
      // Signed out — fall back to an optimistic local folder.
      const local = known ?? createFolder(segment, parentId);
      if (!local) return null;
      parentId = local.id;
      continue;
    }

    // Create it (a unique-name conflict just means it already exists), then read
    // the parent's listing back to learn the real id.
    try {
      await withFreshToken((t) =>
        apiCreateFolder(t, {
          parentFolderId: parentId,
          folderName: segment,
          folderInfo: buildCreationInfo(),
        })
      );
    } catch (err) {
      if (!(err instanceof HttpError)) console.warn("ensureFolderPath: create failed", err);
    }

    const listParentId = parentId;
    let listing: Awaited<ReturnType<typeof listRootFolders>> | undefined;
    try {
      listing = await withFreshToken((t) =>
        listParentId === null
          ? listRootFolders(t, { limit: PAGE_SIZE, offset: 0 })
          : listFolderChildren(t, listParentId, { limit: PAGE_SIZE, offset: 0 })
      );
    } catch (err) {
      console.warn("ensureFolderPath: could not read folder listing", err);
      return null;
    }
    const match = listing?.find((r) => r.is_resource_folder && r.resource_name === segment);
    if (!match) return null;

    const mapped = (listing ?? []).map((r) => mapResource(r, ownerEmail));
    await resolveCreatedByNames(mapped);
    store.set(filesAtom, (prev) => {
      const next = mergeServerListing(prev, listParentId, mapped, "initial");
      saveCache(next);
      return next;
    });
    parentId = match.resource_id;
  }

  return parentId;
};

export const addFile = (input: AddFileInput): FileItem => {
  const safeName = sanitizeName(input.name) || "unnamed";

  const newItem: FileItem = {
    id: "file-" + Date.now() + "-" + randomSuffix(),
    name: safeName,
    isFolder: false,
    parentId: input.parentId,
    size: input.size,
    owner: { name: "me", email: ownerEmail },
    modifiedAt: nowIso(),
    createdAt: nowIso(),
    isStarred: false,
    isDeleted: false,
    type: input.type,
    extension: input.extension,
    blobUrl: URL.createObjectURL(input.blob),
    storageKey: input.storageKey,
    fileId: input.fileId,
    version: input.version,
    resourceInfo: buildCreationInfo(),
    createdBy: userName,
    origin: "local",
  };

  store.set(filesAtom, (prev) => {
    // The backend keeps one row per (folder, file_name); mirror that here. If this
    // upload bumped the version, fold the previous content into the version history
    // instead of dropping it; otherwise it's a plain replace.
    const existing = prev.find((f) => !f.isFolder && f.parentId === newItem.parentId && f.name === safeName);
    if (existing) {
      newItem.isStarred = existing.isStarred;
      newItem.isDeleted = existing.isDeleted;
      newItem.share = existing.share;
      if (input.version && input.version > 1 && existing.storageKey) {
        const snapshot: FileVersion = {
          id: "version-" + Date.now() + "-" + randomSuffix(),
          storageKey: existing.storageKey,
          blobUrl: existing.blobUrl,
          size: existing.size,
          savedAt: existing.modifiedAt,
        };
        newItem.versions = [snapshot, ...(existing.versions ?? [])];
      } else {
        newItem.versions = existing.versions;
      }
    }

    const updated = [...prev.filter((f) => !(!f.isFolder && f.parentId === newItem.parentId && f.name === safeName)), newItem];
    saveCache(updated);
    return updated;
  });

  return newItem;
};

// For an item inside a "Shared with me" subtree: the shared root id to send as
// shared_folder_id, plus the caller's permissions. null for the user's own items.
const sharedWrite = (id: string): { sharedFolderId: string; perms: InternalSharePermissions } | null => {
  const ctx = sharedSubtreeContext(store.get(filesAtom), id);
  return ctx ? { sharedFolderId: ctx.rootId, perms: ctx.permissions } : null;
};

export const renameItem = (id: string, newName: string) => {
  const safeName = sanitizeName(newName);
  if (!safeName) return;
  const files = store.get(filesAtom);
  const target = files.find((f) => f.id === id);
  if (!target || isItemLocked(target)) return;
  persist(files.map((f) => (f.id === id ? { ...f, name: safeName, modifiedAt: nowIso() } : f)));

  const tk = authSnapshot.token;
  if (!tk || !target) return;
  const shared = sharedWrite(id);

  // edit replaces *_info wholesale — carry the existing info through.
  if (target.isFolder && (target.origin === "server" || target.origin === "shared")) {
    if (shared && !shared.perms.can_update) return; // no edit permission — optimistic only
    runMutation(
      () =>
        withFreshToken((t) =>
          apiEditFolder(t, {
            folderId: id,
            folderName: safeName,
            folderInfo: target.resourceInfo,
            sharedFolderId: shared?.sharedFolderId ?? null,
          })
        ),
      { id, safeName },
      notifySyncFailed("Folder rename did not sync to API", "Couldn't rename the folder")
    );
  } else if (!target.isFolder && target.origin === "server" && target.fileId) {
    if (shared && !shared.perms.can_update) return; // no edit permission
    runMutation(
      () =>
        withFreshToken((t) =>
          apiUpdateFileInfo(t, { 
            folder_id: target.parentId!,
            file_id: target.fileId!, 
            shared_folder_id: shared?.sharedFolderId ?? null,
            file_name: safeName, 
            file_info: target.resourceInfo ?? {},
            file_type: fileTypeGuess(target),
            file_version: target.version ?? 1,
            expected_file_size: target.size,
          })
        ),
      { id, safeName },
      notifySyncFailed("File rename did not sync to API", "Couldn't rename the file")
    );
  }
};

// Merge a UI patch (color / icon) into an item's resource_info.
const mergeUi = (f: FileItem, patch: Partial<ResourceUiInfo>): Record<string, unknown> => {
  const info = (f.resourceInfo ?? {}) as ResourceInfo;
  return { ...info, ui: { ...(info.ui ?? {}), ...patch } };
};

// Persist a resource_info.ui change for a folder (PATCH /folders/edit, which
// replaces folder_info — so send the whole merged object). Works for the user's
// own folders and for shared folders where the caller has can_update.
const patchFolderUi = (id: string, patch: Partial<ResourceUiInfo>) => {
  const target = store.get(filesAtom).find((f) => f.id === id);
  if (!target?.isFolder || !authSnapshot.token) return;
  if (target.origin !== "server" && target.origin !== "shared") return;
  const shared = sharedWrite(id);
  if (shared && !shared.perms.can_update) return;
  const folderInfo = mergeUi(target, patch);
  runMutation(
    () =>
      withFreshToken((t) =>
        apiEditFolder(t, {
          folderId: id,
          folderName: target.name,
          folderInfo,
          sharedFolderId: shared?.sharedFolderId ?? null,
        })
      ),
    { id, patch },
    notifySyncFailed("Folder appearance did not sync to API", "Couldn't save that change")
  );
};

// Starring is personal, per-user state — kept in the user's own private_info
// (starredIdsAtom), never on the resource itself, so starring something you don't
// own or that's shared with others only stars it for you. UserSettingsBridge
// watches this atom and debounce-saves it the same way it does theme/viewMode;
// the FileItem patch here just keeps the currently-listed items' isStarred flag in
// sync immediately (see also the store.sub below, for items listed after the fact).
export const toggleStar = (id: string) => {
  const current = store.get(starredIdsAtom);
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  store.set(starredIdsAtom, next);
};

export const starItems = (ids: string[]) => {
  const current = store.get(starredIdsAtom);
  store.set(starredIdsAtom, Array.from(new Set([...current, ...ids])));
};

// Keeps every already-listed item's isStarred flag in sync whenever starredIdsAtom
// changes — covers both toggleStar/starItems above and UserSettingsBridge's
// initial load-from-server (which can resolve after some folders were already
// mapped with isStarred defaulted to false).
store.sub(starredIdsAtom, () => {
  const ids = store.get(starredIdsAtom);
  setStoredStarredIds(ids);
  const current = store.get(filesAtom);
  const next = current.map((f) => (f.isStarred === ids.includes(f.id) ? f : { ...f, isStarred: ids.includes(f.id) }));
  if (next.some((f, i) => f !== current[i])) persist(next);
});

// Folder colour / icon. Pass null to clear either.
export const setFolderStyle = (id: string, style: { color?: string | null; icon?: string | null }) => {
  const patch: Partial<ResourceUiInfo> = {};
  if ("color" in style) patch.color = style.color ?? undefined;
  if ("icon" in style) patch.icon = style.icon ?? undefined;
  const files = store.get(filesAtom);
  persist(
    files.map((f) =>
      f.id === id
        ? {
            ...f,
            color: "color" in style ? (style.color ?? undefined) : f.color,
            icon: "icon" in style ? (style.icon ?? undefined) : f.icon,
            resourceInfo: mergeUi(f, patch),
          }
        : f
    )
  );
  patchFolderUi(id, patch);
};

// Trashing = mark resource_info.trash_info true AND move the item into the Trash
// folder. For server folders/files both are real API calls (PATCH /folders/edit or
// /files/update, then PUT /folders/move or /files/move); the client mirrors them
// optimistically. Files need the full FileOpsRequest shape (see
// renameItem/moveItems) rather than just {file_id, file_name, file_info}.
export const trashItems = (ids: string[]) => {
  const trashId = store.get(trashFolderIdAtom);
  const files = store.get(filesAtom);
  const unlockedIds = ids.filter((id) => {
    const item = files.find((f) => f.id === id);
    return !isItemLocked(item);
  });
  if (unlockedIds.length === 0) return;
  const targets = new Set(unlockedIds);
  const descendantIds = new Set(unlockedIds.flatMap((id) => getDescendantIds(id)));
  const roots = files.filter((f) => targets.has(f.id));

  persist(
    files.map((f) => {
      if (targets.has(f.id)) {
        return {
          ...f,
          isDeleted: true,
          parentId: trashId ?? f.parentId,
          resourceInfo: { ...(f.resourceInfo ?? {}), trash_info: true },
          modifiedAt: nowIso(),
        };
      }
      if (descendantIds.has(f.id)) return { ...f, isDeleted: true };
      return f;
    })
  );

  if (authSnapshot.token) {
    roots
      .filter((f) => f.isFolder && f.origin === "server")
      .forEach((f) => {
        const folderInfo: ResourceInfo = { ...(f.resourceInfo ?? {}), trash_info: true };
        runMutation(
          () =>
            trackPendingSync(
              f.id,
              withFreshToken(async (t) => {
                await apiEditFolder(t, { folderId: f.id, folderName: f.name, folderInfo });
                if (trashId) await apiMoveFolder(t, { folderId: f.id, newParentFolderId: trashId });
              })
            ),
          { id: f.id },
          notifySyncFailed("Trash did not sync to API", "Couldn't move that to Trash")
        );
      });

    roots
      .filter((f): f is FileItem & { fileId: string; parentId: string } => !f.isFolder && f.origin === "server" && !!f.fileId && !!f.parentId)
      .forEach((f) => {
        const fileInfo: ResourceInfo = { ...(f.resourceInfo ?? {}), trash_info: true };
        const opsShape = {
          folder_id: f.parentId,
          file_id: f.fileId,
          file_name: f.name,
          file_info: fileInfo,
          file_type: fileTypeGuess(f),
          file_version: f.version ?? 1,
          expected_file_size: f.size,
        };
        runMutation(
          () =>
            trackPendingSync(
              f.id,
              withFreshToken(async (t) => {
                await apiUpdateFileInfo(t, opsShape);
                if (trashId) await apiMoveFile(t, trashId, opsShape);
              })
            ),
          { id: f.id },
          notifySyncFailed("Trash did not sync to API", "Couldn't move that to Trash")
        );
      });
  }
};

// Restore no longer auto-returns an item to where it was trashed from — the caller
// picks a destination the same way "Move to…" does (see MoveCopyModal's "restore"
// mode), so this just clears the trash marker and hands off to moveItems for the
// actual relocation (same blocked/unsupported bookkeeping, same API calls).
export const restoreItems = (
  ids: string[],
  destinationId: string | null
): { moved: number; blocked: number; unsupported: number } => {
  const targets = new Set(ids);
  const files = store.get(filesAtom);
  const descendantIds = new Set(ids.flatMap((id) => getDescendantIds(id)));

  persist(
    files.map((f) => {
      if (targets.has(f.id)) {
        return { ...f, isDeleted: false, resourceInfo: { ...(f.resourceInfo ?? {}), trash_info: null } };
      }
      if (descendantIds.has(f.id)) return { ...f, isDeleted: false };
      return f;
    })
  );

  if (authSnapshot.token) {
    targets.forEach((id) => {
      const f = files.find((x) => x.id === id);
      if (!f || f.origin !== "server") return;
      const clearedInfo: ResourceInfo = { ...(f.resourceInfo ?? {}), trash_info: null };
      if (f.isFolder) {
        runMutation(
          () => withFreshToken((t) => apiEditFolder(t, { folderId: id, folderName: f.name, folderInfo: clearedInfo })),
          { id },
          notifySyncFailed("Restore did not sync to API", "Couldn't restore that from Trash")
        );
      } else if (f.fileId && f.parentId) {
        runMutation(
          () =>
            withFreshToken((t) =>
              apiUpdateFileInfo(t, {
                folder_id: f.parentId!,
                file_id: f.fileId!,
                file_name: f.name,
                file_info: clearedInfo,
                file_type: fileTypeGuess(f),
                file_version: f.version ?? 1,
                expected_file_size: f.size,
              })
            ),
          { id },
          notifySyncFailed("Restore did not sync to API", "Couldn't restore that from Trash")
        );
      }
    });
  }

  return moveItems(ids, destinationId);
};

// Permanent delete, unlike trash/restore/move above, is NOT optimistic — this is
// irreversible, so an item only disappears once the server actually confirms it's
// gone (or was never the server's to begin with). Awaited by the caller rather than
// fired via runMutation, so the confirm dialog can report real success/failure counts.
export const permanentDeleteItems = async (ids: string[]): Promise<{ deleted: number; blocked: number }> => {
  const files = store.get(filesAtom);
  const targets = ids
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is FileItem => !!f && !isItemLocked(f));

  if (targets.length < ids.length) {
    showToast(`Skipped ${ids.length - targets.length} locked item(s)`, "error");
  }
  if (targets.length === 0) {
    return { deleted: 0, blocked: ids.length };
  }

  // Local-only items (never touched the server) can just be dropped, folders included —
  // there's nothing server-side to reconcile, so their descendants go with them.
  const localOnly = targets.filter((f) => f.origin !== "server" && f.origin !== "shared");
  const removeIds = new Set(localOnly.flatMap((f) => [f.id, ...getDescendantIds(f.id)]));

  const serverFolders = targets.filter((f) => f.isFolder && (f.origin === "server" || f.origin === "shared"));
  // DELETE /folders/delete purges a folder's whole subtree recursively server-side, so a
  // file/folder that's already inside one of `serverFolders` gets deleted along with it —
  // giving it its own separate delete call too would be redundant (and could easily race
  // the folder's own background purge into a 400/404).
  const coveredByFolderDelete = new Set(serverFolders.flatMap((f) => getDescendantIds(f.id)));
  const serverFiles = targets.filter(
    (f): f is FileItem & { fileId: string; parentId: string } =>
      !f.isFolder &&
      (f.origin === "server" || f.origin === "shared") &&
      !!f.fileId &&
      !!f.parentId &&
      !coveredByFolderDelete.has(f.id)
  );

  let blocked = ids.length - targets.length + (targets.length - localOnly.length - serverFolders.length - serverFiles.length);

  if ((serverFolders.length > 0 || serverFiles.length > 0) && !authSnapshot.token) {
    blocked += serverFolders.length + serverFiles.length;
    showToast("You're signed out — can't permanently delete items right now", "error");
  } else {
    await Promise.all([
      ...serverFolders.map(async (f) => {
        const req = {
          folderId: f.id,
          sharedFolderId: getSharedFolderId(f.parentId),
          folderName: f.name,
          folderInfo: f.resourceInfo ?? {},
        };
        try {
          await withFreshToken((t) => apiDeleteFolder(t, req));
          removeIds.add(f.id);
          getDescendantIds(f.id).forEach((id) => removeIds.add(id));
        } catch (err) {
          blocked += 1;
          notifySyncFailed(`Permanent delete of "${f.name}" did not sync to API`, `Couldn't permanently delete "${f.name}"`)(err);
        }
      }),
      ...serverFiles.map(async (f) => {
        const req = {
          folder_id: f.parentId,
          file_id: f.fileId,
          shared_folder_id: getSharedFolderId(f.parentId),
          file_name: f.name,
          file_info: f.resourceInfo ?? {},
          file_type: fileTypeGuess(f),
          file_version: f.version ?? 1,
          expected_file_size: f.size,
        };
        try {
          await withFreshToken((t) => apiDeleteFile(t, req));
          removeIds.add(f.id);
        } catch (err) {
          blocked += 1;
          notifySyncFailed(`Permanent delete of "${f.name}" did not sync to API`, `Couldn't permanently delete "${f.name}"`)(err);
        }
      }),
    ]);
  }

  if (removeIds.size > 0) {
    persist(store.get(filesAtom).filter((f) => !removeIds.has(f.id)));
  }

  return { deleted: removeIds.size, blocked };
};

// DELETE /files/delete/version — removes one older version of a file (never the
// current/latest one; the server enforces file_version > 1). Also awaited rather than
// optimistic, same reasoning as permanentDeleteItems. Invalidates the file's cached
// available_versions (see useFileInfo/useVersionHistory) so the modal drops it from the
// list on success rather than needing a manual refresh.
export const deleteFileVersion = async (item: FileItem, version: number): Promise<boolean> => {
  if (item.isFolder || !item.fileId || !item.parentId) return false;
  if (isItemLocked(item)) {
    showToast("File is locked and its versions cannot be deleted", "error");
    return false;
  }
  // Server-enforced (routes/files.rs delete_any_file_version): version 1 can never be
  // deleted alone. The UI (VersionHistoryModal) already disables that button; this is a
  // backstop for any other caller, so it fails clearly instead of round-tripping to a 400.
  if (version <= 1) {
    showToast("The first version can't be deleted on its own — delete the whole file instead", "error");
    return false;
  }
  if (!authSnapshot.token) {
    showToast("You're signed out — can't delete that version right now", "error");
    return false;
  }

  const req = {
    folder_id: item.parentId,
    file_id: item.fileId,
    shared_folder_id: getSharedFolderId(item.parentId),
    file_name: item.name,
    file_info: item.resourceInfo ?? {},
    file_type: fileTypeGuess(item),
    file_version: version,
    expected_file_size: item.size,
  };

  try {
    await withFreshToken((t) => apiDeleteFileVersion(t, req));
    queryClient.invalidateQueries({ queryKey: ["fileInfo", item.id] });
    return true;
  } catch (err) {
    notifySyncFailed(`Delete of version ${version} did not sync to API`, `Couldn't delete version ${version}`)(err);
    return false;
  }
};

export const moveItems = (
  ids: string[],
  newParentId: string | null
): { moved: number; blocked: number; unsupported: number } => {
  let moved = 0;
  let blocked = 0;
  let unsupported = 0;
  const folderMoves: { id: string; sharedFolderId: string | null }[] = [];
  const fileMoves: {
    id: string;
    fileId: string;
    sharedFolderId: string | null;
    sourceFolderId: string;
    fileName: string;
    fileInfo: Record<string, unknown>;
    fileType: string;
    fileVersion: number;
    expectedFileSize: number;
  }[] = [];
  const files = store.get(filesAtom);
  const dstShared = newParentId ? sharedSubtreeContext(files, newParentId) : null;
  const next = files.map((f) => f);

  for (const id of ids) {
    const item = next.find((f) => f.id === id);
    if (!item) continue;
    if (isItemLocked(item)) {
      blocked++;
      continue;
    }
    const forbidden = new Set([id, ...getDescendantIds(id)]);
    if (newParentId !== null && forbidden.has(newParentId)) {
      blocked++;
      continue;
    }
    if (item.parentId === newParentId) continue;

    // PUT /files/move/{destination_folder_id} requires a real destination folder
    // UUID — there's no way to move a file to root against that endpoint.
    if (!item.isFolder && newParentId === null) {
      unsupported++;
      continue;
    }

    if (item.origin === "server" || item.origin === "shared") {
      const srcShared = sharedSubtreeContext(files, id);
      const isCrossShare = srcShared?.rootId !== dstShared?.rootId;
      const hasPerms = srcShared ? srcShared.permissions.can_update && srcShared.permissions.can_create : true;

      if (!isCrossShare && hasPerms) {
        if (item.isFolder) {
          folderMoves.push({ id, sharedFolderId: srcShared?.rootId ?? null });
        } else if (item.fileId && item.parentId) {
          fileMoves.push({
            id,
            fileId: item.fileId,
            sharedFolderId: srcShared?.rootId ?? null,
            sourceFolderId: item.parentId,
            fileName: item.name,
            fileInfo: item.resourceInfo ?? {},
            fileType: fileTypeGuess(item),
            fileVersion: item.version ?? 1,
            expectedFileSize: item.size,
          });
        }
      }
    }

    item.parentId = newParentId;
    item.modifiedAt = nowIso();
    moved++;
  }

  if (moved > 0) persist(next);

  const tk = authSnapshot.token;
  if (tk) {
    folderMoves.forEach(({ id, sharedFolderId }) => {
      runMutation(
        () => trackPendingSync(id, withFreshToken((t) => apiMoveFolder(t, { folderId: id, newParentFolderId: newParentId, sharedFolderId }))),
        { id, sharedFolderId },
        notifySyncFailed("Folder move did not sync to API", "Couldn't move that folder")
      );
    });
    // fileMoves is always empty when newParentId is null (files are filtered out as
    // "unsupported" above), so apiMoveFile's non-null destination is always valid here.
    fileMoves.forEach(({ id, fileId, sharedFolderId, sourceFolderId, fileName, fileInfo, fileType, fileVersion, expectedFileSize }) => {
      runMutation(
        () =>
          trackPendingSync(
            id,
            withFreshToken((t) =>
              apiMoveFile(t, newParentId as string, {
                folder_id: sourceFolderId,
                file_id: fileId,
                shared_folder_id: sharedFolderId,
                file_name: fileName,
                file_info: fileInfo,
                file_type: fileType,
                file_version: fileVersion,
                expected_file_size: expectedFileSize,
              })
            )
          ),
        { id, sharedFolderId },
        notifySyncFailed("File move did not sync to API", "Couldn't move that file")
      );
    });
  }

  return { moved, blocked, unsupported };
};

export const copyItem = (id: string, newParentId: string | null): { copied: number; blocked: boolean } => {
  const files = store.get(filesAtom);
  const source = files.find((f) => f.id === id);
  if (!source) return { copied: 0, blocked: false };
  if (isItemLocked(source)) return { copied: 0, blocked: true };

  const forbidden = new Set([id, ...getDescendantIds(id)]);
  if (newParentId !== null && forbidden.has(newParentId)) {
    return { copied: 0, blocked: true };
  }

  const idMap = new Map<string, string>();
  const now = nowIso();
  const makeCopyId = (originalId: string) => {
    const copyId = originalId + "-copy-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    idMap.set(originalId, copyId);
    return copyId;
  };

  const rootCopy: FileItem = {
    ...source,
    id: makeCopyId(source.id),
    parentId: newParentId,
    name: source.isFolder ? source.name : `Copy of ${source.name}`,
    createdAt: now,
    modifiedAt: now,
    origin: "local",
  };

  const descendantIds = getDescendantIds(id);
  const descendantCopies: FileItem[] = descendantIds.map((descId) => {
    const desc = files.find((f) => f.id === descId)!;
    return { ...desc, id: makeCopyId(descId), createdAt: now, modifiedAt: now, origin: "local" };
  });

  descendantIds.forEach((originalId, i) => {
    const originalParentId = files.find((f) => f.id === originalId)!.parentId;
    if (originalParentId && idMap.has(originalParentId)) {
      descendantCopies[i].parentId = idMap.get(originalParentId)!;
    }
  });

  persist([...files, rootCopy, ...descendantCopies]);
  return { copied: 1 + descendantCopies.length, blocked: false };
};

export const updateFileContent = async (id: string, blob: Blob): Promise<void> => {
  const files = store.get(filesAtom);
  const target = files.find((f) => f.id === id);
  if (isItemLocked(target)) {
    throw new Error("File is locked and cannot be modified");
  }
  const storageKey = generateStorageKey();
  await putBlob(storageKey, blob);
  const blobUrl = URL.createObjectURL(blob);
  store.set(filesAtom, (prev) => {
    const updated = prev.map((f) => {
      if (f.id !== id) return f;
      const priorVersions = f.versions ?? [];
      const snapshot: FileVersion | null = f.storageKey
        ? {
            id: "version-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
            storageKey: f.storageKey,
            blobUrl: f.blobUrl,
            size: f.size,
            savedAt: f.modifiedAt,
          }
        : null;
      return {
        ...f,
        blobUrl,
        storageKey,
        size: blob.size,
        modifiedAt: nowIso(),
        versions: snapshot ? [snapshot, ...priorVersions] : priorVersions,
      };
    });
    saveCache(updated);
    return updated;
  });
};

export const restoreVersion = (id: string, versionId: string) => {
  const files = store.get(filesAtom);
  const targetItem = files.find((f) => f.id === id);
  if (isItemLocked(targetItem)) return;
  store.set(filesAtom, (prev) => {
    const updated = prev.map((f) => {
      if (f.id !== id) return f;
      const target = f.versions?.find((v) => v.id === versionId);
      if (!target) return f;

      const remaining = f.versions!.filter((v) => v.id !== versionId);
      const currentAsVersion: FileVersion = {
        id: "version-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        storageKey: f.storageKey!,
        blobUrl: f.blobUrl,
        size: f.size,
        savedAt: f.modifiedAt,
      };

      return {
        ...f,
        storageKey: target.storageKey,
        blobUrl: target.blobUrl,
        size: target.size,
        modifiedAt: nowIso(),
        versions: [currentAsVersion, ...remaining],
      };
    });
    saveCache(updated);
    return updated;
  });
};

export const setShareSettings = (id: string, settings: ShareSettings) => {
  store.set(filesAtom, (prev) => {
    const updated = prev.map((f) => (f.id === id ? { ...f, share: settings } : f));
    saveCache(updated);
    return updated;
  });
};

export const clearShareSettings = (id: string) => {
  store.set(filesAtom, (prev) => {
    const updated = prev.map((f) => (f.id === id ? { ...f, share: undefined } : f));
    saveCache(updated);
    return updated;
  });
};
