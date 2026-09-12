import { getDefaultStore } from "jotai";
import type { FileItem, FileVersion, ShareSettings } from "../types/file";
import { SHARED_ROOT_ID } from "../types/file";
import type {
  BackendResource,
  FolderTrashInfo,
  InternalSharedResource,
  InternalSharePermissions,
  ResourceInfo,
  ResourceUiInfo,
} from "@yfs/service";
import {
  HttpError,
  PAGE_SIZE,
  listRootFolders,
  listFolderChildren,
  createFolder as apiCreateFolder,
  editFolder as apiEditFolder,
  moveFolder as apiMoveFolder,
  listSharingIn,
  listSharingOut,
  listSharedFolderChildren,
  listExternalShares,
  deleteExternalShare,
  updateFileInfo as apiUpdateFileInfo,
  getUserById,
} from "@yfs/service";
import { sanitizeName, categorizeByName } from "../utils/fileType";
import { generateStorageKey, getBlob, putBlob } from "../services/blobStore";
import { queryClient } from "../lib/queryClient";
import { showToast } from "../atoms/toast";
import {
  filesAtom,
  isLoadingAtom,
  remoteErrorAtom,
  pageInfoAtom,
  trashFolderIdAtom,
  sharedOutAtom,
  sharedLinksAtom,
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
let ownerEmail = "me@yukthi.net";
let userName: string | undefined;

export function setAuthSnapshot(next: AuthSnapshot) {
  authSnapshot = next;
}

export function setUserSnapshot(email: string | undefined, name: string | undefined) {
  ownerEmail = email || "me@yukthi.net";
  userName = name;
}

// How many rows we've pulled for each folder key and whether the server has more.
// (Caching/dedup of the actual network requests is queryClient's job now — see
// folderQueryKey below — this Map only tracks pagination bookkeeping for the UI.)
const pageState = new Map<string, { loaded: number; hasMore: boolean }>();

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

  const common = {
    id: r.resource_id,
    name: r.resource_name,
    parentId: r.parent_folder_id ?? null,
    size: r.total_resource_size ?? 0,
    owner: { name: "me", email: ownerEmailForRow },
    modifiedAt: r.updated_at,
    createdAt: r.created_at,
    isStarred: !!ui?.starred,
    color: ui?.color,
    icon: ui?.icon,
    createdBy: info?.creation_info?.user_name,
    // trash_info in resource_info is the source of truth for "is trashed".
    isDeleted: !!trash,
    trashedFrom: trash ? trash.trashed_from : undefined,
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

// Map a "shared with me" folder into a FileItem parked under SHARED_ROOT_ID.
const mapSharedResource = (r: InternalSharedResource): FileItem => {
  const info = (r.resource_info ?? undefined) as ResourceInfo | undefined;
  return {
    id: r.resource_id,
    name: r.resource_name,
    isFolder: true,
    parentId: SHARED_ROOT_ID,
    size: r.total_resource_size ?? 0,
    owner: { name: "Shared", email: "" },
    modifiedAt: r.updated_at,
    createdAt: r.created_at,
    isStarred: false,
    isDeleted: false,
    type: "folder",
    origin: "shared",
    createdBy: info?.creation_info?.user_name,
    resourceInfo: info,
    sharedIn: {
      ownerUserId: r.user_id,
      permissions: { ...r.permission_set },
    },
  };
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
  append = false
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
  const merged: FileItem[] = working.map((f) => {
    const res = incoming.find((r) => r.id === f.id);
    if (!res) return f;
    
    return {
      ...res,
      // isStarred / color / icon now live in resource_info (carried by ...res).
      // trash_info in resource_info (res) is authoritative. Folders keep a local
      // optimistic flag too (trashItems syncs them, but the real edit may not have
      // landed yet) — files never get a local one now (trash is blocked client-side
      // for files, see useFileActions.ts), so always trust the server for them;
      // otherwise a file trashed before that block existed would stay stuck
      // "deleted" locally forever even once the server says otherwise.
      isDeleted: f.isFolder ? f.isDeleted || res.isDeleted : res.isDeleted,
      trashedFrom: f.trashedFrom ?? res.trashedFrom,
      share: f.share,
      versions: f.versions,
      blobUrl: f.blobUrl,
      storageKey: f.storageKey,
      // fileId now comes from the server listing itself (mapResource) — prefer it,
      // falling back to a locally-set one only if this particular row is missing it.
      // version isn't in the listing at all yet, so keep whatever the upload set.
      fileId: res.fileId ?? f.fileId,
      version: f.version,
    };
  });
  for (const res of incoming) {
    if (!workingIds.has(res.id)) merged.push(res);
  }

  // When appending a later page we only have a slice of the folder's children, so the
  // "vanished server-side" check below would wrongly drop every earlier page. Skip it.
  if (append) return merged;

  // 3. Drop rows that are direct children of this folder but aren't in the fresh
  //    listing:
  //    - server rows that vanished server-side (deleted elsewhere)
  //    - orphaned optimistic folders whose create never landed — nothing retries
  //      them and fetchFolderPage won't list their children, so a kept row is a
  //      permanent phantom. A just-created one (within the grace window) is spared
  //      in case its create call is still in flight.
  //    Rows carrying client-only state worth keeping (starred / trashed / shared)
  //    are never dropped.
  return merged.filter((f) => {
    if (f.parentId !== parentId) return true;
    if (incomingIds.has(f.id)) return true;
    if (f.isStarred || f.isDeleted || f.share) return true;
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

const setPageLoading = (key: string, loading: boolean, hasMore?: boolean) =>
  store.set(pageInfoAtom, (p) => ({
    ...p,
    [key]: { hasMore: hasMore ?? p[key]?.hasMore ?? true, loading },
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

// Metadata stamped into a new folder's folder_info (echoed back as resource_info).
const buildCreationInfo = (parentFolderId: string | null): ResourceInfo => ({
  creation_info: {
    user_id: authSnapshot.userId ?? undefined,
    user_name: userName,
    parent_folder_id: parentFolderId,
    created_at: nowIso(),
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

  const offset = mode === "append" ? state.loaded : 0;
  const queryKey = folderQueryKey(key, offset);
  // Force resets to page 1 and drops every cached page for this folder, so a later
  // "append" naturally re-fetches rather than returning a stale pre-force page.
  if (mode === "force" && offset === 0) {
    await queryClient.invalidateQueries({ queryKey: ["folder", key] });
  }
  setPageLoading(key, true, state.hasMore);

  try {
    // queryClient dedupes identical in-flight (queryKey) fetches on its own — no
    // manual in-flight guard needed here anymore.
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
    store.set(filesAtom, (prev) => {
      const next = mergeServerListing(prev, parentId, mapped, mode === "append");
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
  }
};

export const loadFolder = (parentId: string | null, opts?: { force?: boolean }) =>
  fetchFolderPage(parentId, opts?.force ? "force" : "initial");

export const loadMoreFolder = (parentId: string | null) => fetchFolderPage(parentId, "append");

// Shared-with-me folders, paged the same way. `mode` matches fetchFolderPage.
const fetchSharedPage = async (mode: "initial" | "force" | "append") => {
  if (!authSnapshot.token) return;
  const key = SHARED_ROOT_ID;

  const state = pageState.get(key) ?? { loaded: 0, hasMore: true };
  if (mode === "append" && !state.hasMore) return;

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
    store.set(filesAtom, (prev) => {
      // "force"/"initial" replace the whole bucket; "append" adds the new page,
      // skipping any id already present.
      const kept = mode === "append" ? prev : prev.filter((f) => f.origin !== "shared");
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
    store.set(
      sharedOutAtom,
      [...byId.values()].map((r) => {
        const item = mapSharedResource(r);
        item.parentId = null;
        item.owner = { name: "me", email: ownerEmail };
        return item;
      })
    );
    store.set(remoteErrorAtom, null);
  } catch (err) {
    if (err instanceof AuthUnavailableError) return;
    console.warn("Failed to load shared-out folders", err);
    showToast(err instanceof Error ? err.message : "Couldn't load folders you've shared", "error");
  }
};

export const loadSharedLinks = async (opts?: { force?: boolean }) => {
  if (!authSnapshot.token) return;
  if (opts?.force) await queryClient.invalidateQueries({ queryKey: SHARED_LINKS_QUERY_KEY });
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
    store.set(remoteErrorAtom, null);
  } catch (err) {
    if (err instanceof AuthUnavailableError) return;
    console.warn("Failed to load public links", err);
    showToast(err instanceof Error ? err.message : "Couldn't load public links", "error");
  }
};

export const revokeSharedLink = async (shareId: string) => {
  await withFreshToken((tk) => deleteExternalShare(tk, shareId));
  store.set(sharedLinksAtom, (prev) => prev.filter((s) => s.share_id !== shareId));
};

export const getSharedFolderId = (folderId: string | null): string | null =>
  folderId !== null ? (sharedSubtreeContext(store.get(filesAtom), folderId)?.rootId ?? null) : null;

export const getSharedPermissions = (itemId: string | null): InternalSharePermissions | null =>
  itemId !== null ? (sharedSubtreeContext(store.get(filesAtom), itemId)?.permissions ?? null) : null;

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
          folderInfo: buildCreationInfo(null),
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
  store.set(filesAtom, (prev) => {
    const next = mergeServerListing(prev, null, mapped, false);
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
  store.set(sharedLinksAtom, []);
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

  const creationInfo = buildCreationInfo(parentId);
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
          folderInfo: buildCreationInfo(parentId),
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
    store.set(filesAtom, (prev) => {
      const next = mergeServerListing(prev, listParentId, mapped, false);
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
    runMutation(
      () =>
        withFreshToken((t) =>
          apiUpdateFileInfo(t, { file_id: target.fileId!, file_name: safeName, file_info: target.resourceInfo ?? {} })
        ),
      { id, safeName },
      notifySyncFailed("File rename did not sync to API", "Couldn't rename the file")
    );
  }
};

// Merge a UI patch (starred / color / icon) into an item's resource_info.
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

export const toggleStar = (id: string) => {
  const files = store.get(filesAtom);
  const next = !files.find((f) => f.id === id)?.isStarred;
  persist(files.map((f) => (f.id === id ? { ...f, isStarred: next, resourceInfo: mergeUi(f, { starred: next }) } : f)));
  patchFolderUi(id, { starred: next });
};

export const starItems = (ids: string[]) => {
  const files = store.get(filesAtom);
  persist(files.map((f) => (ids.includes(f.id) ? { ...f, isStarred: true, resourceInfo: mergeUi(f, { starred: true }) } : f)));
  ids.forEach((id) => patchFolderUi(id, { starred: true }));
};

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

// Trashing = record where it came from in resource_info.trash_info AND move the
// item into the Trash folder. For server folders both are real API calls
// (PATCH /folders/edit then PUT /folders/move); the client mirrors them optimistically.
export const trashItems = (ids: string[]) => {
  const trashId = store.get(trashFolderIdAtom);
  const targets = new Set(ids);
  const files = store.get(filesAtom);
  const descendantIds = new Set(ids.flatMap((id) => getDescendantIds(id)));
  const roots = files.filter((f) => targets.has(f.id));
  const parentNameById = new Map(files.map((f) => [f.id, f.name]));

  const trashInfoFor = (f: FileItem): FolderTrashInfo => ({
    trashed_from: f.parentId,
    trashed_from_name: f.parentId ? parentNameById.get(f.parentId) : undefined,
    trashed_by: authSnapshot.userId ?? undefined,
    trashed_by_name: userName,
    trashed_at: nowIso(),
  });

  persist(
    files.map((f) => {
      if (targets.has(f.id)) {
        return {
          ...f,
          isDeleted: true,
          trashedFrom: f.parentId,
          parentId: trashId ?? f.parentId,
          resourceInfo: { ...(f.resourceInfo ?? {}), trash_info: trashInfoFor(f) },
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
        const folderInfo: ResourceInfo = { ...(f.resourceInfo ?? {}), trash_info: trashInfoFor(f) };
        runMutation(
          () =>
            withFreshToken(async (t) => {
              await apiEditFolder(t, { folderId: f.id, folderName: f.name, folderInfo });
              if (trashId) await apiMoveFolder(t, { folderId: f.id, newParentFolderId: trashId });
            }),
          { id: f.id },
          notifySyncFailed("Trash did not sync to API", "Couldn't move that to Trash")
        );
      });
  }
};

export const restoreItems = (ids: string[]) => {
  const targets = new Set(ids);
  const files = store.get(filesAtom);
  const descendantIds = new Set(ids.flatMap((id) => getDescendantIds(id)));
  const roots = files.filter((f) => targets.has(f.id));

  const withoutTrashInfo = (info: FileItem["resourceInfo"]): ResourceInfo => {
    const next = { ...(info ?? {}) } as ResourceInfo;
    next.trash_info = null;
    return next;
  };

  persist(
    files.map((f) => {
      if (targets.has(f.id)) {
        return {
          ...f,
          isDeleted: false,
          trashedFrom: undefined,
          parentId: f.trashedFrom ?? null,
          resourceInfo: withoutTrashInfo(f.resourceInfo),
          modifiedAt: nowIso(),
        };
      }
      if (descendantIds.has(f.id)) return { ...f, isDeleted: false };
      return f;
    })
  );

  if (authSnapshot.token) {
    roots
      .filter((f) => f.isFolder && f.origin === "server")
      .forEach((f) => {
        const folderInfo = withoutTrashInfo(f.resourceInfo);
        const restoreTo = f.trashedFrom ?? null;
        runMutation(
          () =>
            withFreshToken(async (t) => {
              await apiEditFolder(t, { folderId: f.id, folderName: f.name, folderInfo });
              await apiMoveFolder(t, { folderId: f.id, newParentFolderId: restoreTo });
            }),
          { id: f.id },
          notifySyncFailed("Restore did not sync to API", "Couldn't restore that from Trash")
        );
      });
  }
};

export const permanentDeleteItems = (ids: string[]) => {
  const allIds = new Set(ids.flatMap((id) => [id, ...getDescendantIds(id)]));
  persist(store.get(filesAtom).filter((f) => !allIds.has(f.id)));
};

export const moveItems = (ids: string[], newParentId: string | null): { moved: number; blocked: number } => {
  let moved = 0;
  let blocked = 0;
  // Folder moves to sync server-side, with the shared_folder_id (if any) resolved
  // BEFORE we mutate parentId below (the walk-up needs the pre-move tree).
  const folderMoves: { id: string; sharedFolderId: string | null }[] = [];
  const files = store.get(filesAtom);
  // A "Shared with me" folder can only be moved to another spot in the SAME share,
  // and only with can_update + can_create — otherwise the change stays client-only.
  const dstShared = newParentId ? sharedSubtreeContext(files, newParentId) : null;
  const next = files.map((f) => f);

  for (const id of ids) {
    const item = next.find((f) => f.id === id);
    if (!item) continue;
    const forbidden = new Set([id, ...getDescendantIds(id)]);
    if (newParentId !== null && forbidden.has(newParentId)) {
      blocked++;
      continue;
    }
    if (item.parentId === newParentId) continue;

    if (item.isFolder && (item.origin === "server" || item.origin === "shared")) {
      const srcShared = sharedSubtreeContext(files, id);
      if (srcShared) {
        if (dstShared?.rootId === srcShared.rootId && srcShared.permissions.can_update && srcShared.permissions.can_create) {
          folderMoves.push({ id, sharedFolderId: srcShared.rootId });
        }
        // cross-share / no-permission move: optimistic only, no API call
      } else if (item.origin === "server") {
        folderMoves.push({ id, sharedFolderId: null });
      }
    }

    item.parentId = newParentId;
    item.modifiedAt = nowIso();
    moved++;
  }

  if (moved > 0) persist(next);

  const tk = authSnapshot.token;
  if (tk && folderMoves.length > 0) {
    folderMoves.forEach(({ id, sharedFolderId }) => {
      runMutation(
        () => withFreshToken((t) => apiMoveFolder(t, { folderId: id, newParentFolderId: newParentId, sharedFolderId })),
        { id, sharedFolderId },
        notifySyncFailed("Folder move did not sync to API", "Couldn't move that folder")
      );
    });
  }

  return { moved, blocked };
};

export const copyItem = (id: string, newParentId: string | null): { copied: number; blocked: boolean } => {
  const files = store.get(filesAtom);
  const source = files.find((f) => f.id === id);
  if (!source) return { copied: 0, blocked: false };

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
