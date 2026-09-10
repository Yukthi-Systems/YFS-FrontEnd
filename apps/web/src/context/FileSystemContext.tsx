import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { FileItem, FileVersion, ShareSettings } from "../types/file";
import { SHARED_ROOT_ID } from "../types/file";
import type {
  BackendResource,
  ExternalShare,
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
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "yfs_fs_cache";
const ROOT_KEY = "__root__";
// A real root folder that holds trashed items. Auto-created on first login.
const TRASH_FOLDER_NAME = "Trash";

export interface AddFileInput {
  name: string;
  parentId: string | null;
  size: number;
  type: FileItem["type"];
  extension?: string;
  storageKey: string;
  blob: Blob;
  fileId?: string; // logical files.file_id from the upload backend
  version?: number; // file_versions.file_version this upload produced
}

// Per-folder infinite-scroll state, exposed so the UI can render a loading row and
// know when to stop asking for more.
export interface PaginationInfo {
  hasMore: boolean;
  loading: boolean;
}

interface FileSystemContextType {
  files: FileItem[];
  isLoading: boolean;
  remoteError: string | null;
  // Fetches a folder's first page of direct children from YFS-Main-API and merges
  // them in. `parentId: null` = the user's root. Cached per folder unless `force` is set.
  loadFolder: (parentId: string | null, opts?: { force?: boolean }) => Promise<void>;
  // Fetches the next page of a folder's children (infinite scroll). No-op if the
  // last page has already been reached or a page is already in flight.
  loadMoreFolder: (parentId: string | null) => Promise<void>;
  // Fetches the first page of folders shared with me (GET /share/internal/list/sharing-in)
  // into the SHARED_ROOT_ID bucket. Cached unless `force` is set.
  loadSharedFolders: (opts?: { force?: boolean }) => Promise<void>;
  // Fetches the next page of shared-with-me folders (infinite scroll).
  loadMoreSharedFolders: () => Promise<void>;
  // Folders I've shared with other users (GET /share/internal/list/sharing-out).
  sharedOut: FileItem[];
  loadSharedOut: (opts?: { force?: boolean }) => Promise<void>;
  // Public links I've created (GET /share/external/list).
  sharedLinks: ExternalShare[];
  loadSharedLinks: (opts?: { force?: boolean }) => Promise<void>;
  revokeSharedLink: (shareId: string) => Promise<void>;
  // Current infinite-scroll status for a folder listing (or the shared bucket).
  getPagination: (parentId: string | null, shared?: boolean) => PaginationInfo;
  createFolder: (name: string, parentId: string | null) => FileItem | null;
  // Creates every missing folder in `segments` under `rootParentId` server-side (skipping
  // ones that already exist) and resolves to the real folder id of the deepest segment,
  // or null if it couldn't be resolved. Falls back to optimistic local folders when
  // signed out. Used by folder uploads, which need real ids before signing.
  ensureFolderPath: (segments: string[], rootParentId: string | null) => Promise<string | null>;
  // Id of the auto-created "Trash" root folder (null until it's been resolved/created).
  trashFolderId: string | null;
  addFile: (input: AddFileInput) => FileItem;
  renameItem: (id: string, newName: string) => void;
  toggleStar: (id: string) => void;
  starItems: (ids: string[]) => void;
  // Set/clear a folder's colour and/or icon (persisted in resource_info.ui).
  setFolderStyle: (id: string, style: { color?: string | null; icon?: string | null }) => void;
  trashItems: (ids: string[]) => void;
  restoreItems: (ids: string[]) => void;
  permanentDeleteItems: (ids: string[]) => void;
  moveItems: (ids: string[], newParentId: string | null) => { moved: number; blocked: number };
  copyItem: (id: string, newParentId: string | null) => { copied: number; blocked: boolean };
  updateFileContent: (id: string, blob: Blob) => Promise<void>;
  restoreVersion: (id: string, versionId: string) => void;
  setShareSettings: (id: string, settings: ShareSettings) => void;
  clearShareSettings: (id: string) => void;
  getDescendantIds: (id: string) => string[];
  // If `folderId` sits inside a "Shared with me" subtree, the id of the folder
  // actually shared with the user (the shared-subtree root) — what the API's
  // shared_folder_id expects. null for the user's own folders.
  getSharedFolderId: (folderId: string | null) => string | null;
}

const FileSystemContext = createContext<FileSystemContextType | null>(null);

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

// Map a raw API resource (folder or file) into the app's FileItem shape.
const mapResource = (r: BackendResource, ownerEmail: string): FileItem => {
  const info = (r.resource_info ?? undefined) as ResourceInfo | undefined;
  const trash = info?.trash_info ?? null;
  const ui = info?.ui;

  const common = {
    id: r.resource_id,
    name: r.resource_name,
    parentId: r.parent_folder_id ?? null,
    size: r.total_resource_size ?? 0,
    owner: { name: "me", email: ownerEmail },
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
  return { ...common, isFolder: false, type, extension: extension || undefined };
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
    permissions: {
      can_preview: r.can_preview,
      can_download: r.can_download,
      can_create: r.can_create,
      can_update: r.can_update,
      can_delete: r.can_delete,
    },
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
      // trash_info in resource_info (res) is authoritative; also keep a local flag
      // set optimistically before the edit has synced.
      isDeleted: f.isDeleted || res.isDeleted,
      trashedFrom: f.trashedFrom ?? res.trashedFrom,
      share: f.share,
      versions: f.versions,
      blobUrl: f.blobUrl,
      storageKey: f.storageKey,
      // The folder listing doesn't carry version/file-id yet — keep what the upload set.
      fileId: f.fileId,
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

export const FileSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token, userId, user, refreshAccessToken } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  // Infinite-scroll status per folder key (ROOT_KEY / folder id / SHARED_ROOT_ID).
  const [pageInfo, setPageInfo] = useState<Record<string, PaginationInfo>>({});
  const [trashFolderId, setTrashFolderId] = useState<string | null>(null);
  const [sharedOut, setSharedOut] = useState<FileItem[]>([]);
  const [sharedLinks, setSharedLinks] = useState<ExternalShare[]>([]);

  // Refs so async callbacks always see current values without re-creating themselves.
  const authRef = useRef({ token, userId, refreshAccessToken });
  authRef.current = { token, userId, refreshAccessToken };
  const filesRef = useRef<FileItem[]>(files);
  filesRef.current = files;
  const ownerEmailRef = useRef(user?.email || "me@yukthi.net");
  ownerEmailRef.current = user?.email || "me@yukthi.net";
  const displayName = (u: typeof user) =>
    u?.username || [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || undefined;
  const userNameRef = useRef<string | undefined>(displayName(user));
  userNameRef.current = displayName(user);
  const loadedFoldersRef = useRef<Set<string>>(new Set());
  // Folder keys with a listing request currently in flight (dedupes racing effects).
  const inFlightRef = useRef<Set<string>>(new Set());
  // How many rows we've pulled for each folder key and whether the server has more.
  const pageStateRef = useRef<Map<string, { loaded: number; hasMore: boolean }>>(new Map());
  const trashFolderIdRef = useRef<string | null>(null);
  trashFolderIdRef.current = trashFolderId;

  const pageKeyFor = (parentId: string | null, shared?: boolean) =>
    shared ? SHARED_ROOT_ID : parentId ?? ROOT_KEY;

  const setPageLoading = (key: string, loading: boolean, hasMore?: boolean) =>
    setPageInfo((p) => ({
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
    setFiles(updated);
    saveCache(updated);
  };

  // Metadata stamped into a new folder's folder_info (echoed back as resource_info).
  const buildCreationInfo = (parentFolderId: string | null): ResourceInfo => ({
    creation_info: {
      user_id: authRef.current.userId ?? undefined,
      user_name: userNameRef.current,
      parent_folder_id: parentFolderId,
      created_at: nowIso(),
    },
  });

  // Runs an API call with the current token; on 401/400 refreshes once and retries.
  const withFreshToken = useCallback(async <T,>(fn: (token: string) => Promise<T>): Promise<T | undefined> => {
    const { token: current } = authRef.current;
    if (!current) return undefined;
    try {
      return await fn(current);
    } catch (err) {
      if (err instanceof HttpError && (err.status === 401 || err.status === 400)) {
        const fresh = await authRef.current.refreshAccessToken();
        if (!fresh) return undefined;
        return await fn(fresh);
      }
      throw err;
    }
  }, []);

  // One folder page fetch. `mode` picks the intent:
  //   "initial" — first visit, skipped if the folder is already cached
  //   "force"   — re-fetch page 1, resetting the scroll position
  //   "append"  — pull the next page for infinite scroll
  const fetchFolderPage = useCallback(
    async (parentId: string | null, mode: "initial" | "force" | "append") => {
      if (!authRef.current.token) return;
      const key = parentId ?? ROOT_KEY;

      if (mode === "initial" && loadedFoldersRef.current.has(key)) return;

      // A folder inside a "Shared with me" folder is listed through the share endpoint
      // as the folder's owner, not the normal listing.
      const shared = parentId !== null ? sharedSubtreeContext(filesRef.current, parentId) : null;

      // Client-only folders (created offline, not yet synced) have no server listing.
      // Shared-subtree folders do (via the share endpoint), so don't skip those.
      if (parentId !== null && !shared) {
        const folder = filesRef.current.find((f) => f.id === parentId);
        if (folder && folder.origin !== "server") return;
      }

      const state = pageStateRef.current.get(key) ?? { loaded: 0, hasMore: true };
      if (mode === "append" && !state.hasMore) return;
      // Synchronous guard: two effects racing to load the same folder (e.g. the
      // FileSystemContext boot fetch + App's nav effect) would otherwise both fire.
      if (inFlightRef.current.has(key)) return;
      inFlightRef.current.add(key);

      const offset = mode === "append" ? state.loaded : 0;
      setPageLoading(key, true, state.hasMore);

      try {
        const resources = await withFreshToken((tk) =>
          parentId === null
            ? listRootFolders(tk, { limit: PAGE_SIZE, offset })
            : shared
              ? listSharedFolderChildren(tk, shared.rootId, parentId, { limit: PAGE_SIZE, offset })
              : listFolderChildren(tk, parentId, { limit: PAGE_SIZE, offset })
        );
        if (!resources) {
          setPageLoading(key, false);
          return;
        }

        const hasMore = resources.length === PAGE_SIZE;
        pageStateRef.current.set(key, { loaded: offset + resources.length, hasMore });
        loadedFoldersRef.current.add(key);
        setRemoteError(null);

        const inTrash = parentId !== null && parentId === trashFolderIdRef.current;
        const mapped = resources.map((r) => {
          const item = mapResource(r, ownerEmailRef.current);
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
        setFiles((prev) => {
          const next = mergeServerListing(prev, parentId, mapped, mode === "append");
          saveCache(next);
          return next;
        });
        setPageLoading(key, false, hasMore);
      } catch (err) {
        console.warn("Failed to load folder from YFS-Main-API", err);
        setRemoteError(err instanceof Error ? err.message : "Could not reach the file service");
        setPageLoading(key, false);
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [withFreshToken]
  );

  const loadFolder = useCallback(
    (parentId: string | null, opts?: { force?: boolean }) =>
      fetchFolderPage(parentId, opts?.force ? "force" : "initial"),
    [fetchFolderPage]
  );

  const loadMoreFolder = useCallback(
    (parentId: string | null) => fetchFolderPage(parentId, "append"),
    [fetchFolderPage]
  );

  // Shared-with-me folders, paged the same way. `mode` matches fetchFolderPage.
  const fetchSharedPage = useCallback(
    async (mode: "initial" | "force" | "append") => {
      if (!authRef.current.token) return;
      const key = SHARED_ROOT_ID;

      if (mode === "initial" && loadedFoldersRef.current.has(key)) return;

      const state = pageStateRef.current.get(key) ?? { loaded: 0, hasMore: true };
      if (mode === "append" && !state.hasMore) return;
      if (inFlightRef.current.has(key)) return;
      inFlightRef.current.add(key);

      const offset = mode === "append" ? state.loaded : 0;
      setPageLoading(key, true, state.hasMore);

      try {
        const shared = await withFreshToken((tk) => listSharingIn(tk, { limit: PAGE_SIZE, offset }));
        if (!shared) {
          setPageLoading(key, false);
          return;
        }

        const hasMore = shared.length === PAGE_SIZE;
        pageStateRef.current.set(key, { loaded: offset + shared.length, hasMore });
        loadedFoldersRef.current.add(key);
        setRemoteError(null);

        // Resolve each owner once so the list shows who shared the folder — prefer
        // their public_info.display_name, fall back to the email local-part.
        const owners = new Map<string, { name: string; email: string }>();
        await Promise.all(
          [...new Set(shared.map((s) => s.user_id))].map(async (ownerId) => {
            try {
              const owner = await withFreshToken((tk) => getUserById(tk, ownerId));
              if (owner) {
                const displayName =
                  typeof owner.public_info?.display_name === "string"
                    ? owner.public_info.display_name.trim()
                    : "";
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
        setFiles((prev) => {
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
        console.warn("Failed to load shared folders from YFS-Main-API", err);
        setRemoteError(err instanceof Error ? err.message : "Could not reach the file service");
        setPageLoading(key, false);
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [withFreshToken]
  );

  const loadSharedFolders = useCallback(
    (opts?: { force?: boolean }) => fetchSharedPage(opts?.force ? "force" : "initial"),
    [fetchSharedPage]
  );

  const loadMoreSharedFolders = useCallback(() => fetchSharedPage("append"), [fetchSharedPage]);

  // Folders I've shared out. One row per recipient, so dedupe by folder id.
  const loadSharedOut = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!authRef.current.token) return;
      if (!opts?.force && loadedFoldersRef.current.has("__shared_out__")) return;
      try {
        const rows = await withFreshToken((tk) => listSharingOut(tk, { limit: PAGE_SIZE, offset: 0 }));
        if (!rows) return;
        const byId = new Map<string, InternalSharedResource>();
        for (const r of rows) byId.set(r.resource_id, r);
        setSharedOut(
          [...byId.values()].map((r) => {
            const item = mapSharedResource(r);
            item.parentId = null;
            item.owner = { name: "me", email: ownerEmailRef.current };
            return item;
          })
        );
        loadedFoldersRef.current.add("__shared_out__");
        setRemoteError(null);
      } catch (err) {
        console.warn("Failed to load shared-out folders", err);
      }
    },
    [withFreshToken]
  );

  const loadSharedLinks = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!authRef.current.token) return;
      if (!opts?.force && loadedFoldersRef.current.has("__shared_links__")) return;
      try {
        const rows = await withFreshToken((tk) => listExternalShares(tk, { limit: PAGE_SIZE, offset: 0 }));
        if (!rows) return;
        setSharedLinks(rows);
        loadedFoldersRef.current.add("__shared_links__");
        setRemoteError(null);
      } catch (err) {
        console.warn("Failed to load public links", err);
      }
    },
    [withFreshToken]
  );

  const revokeSharedLink = useCallback(
    async (shareId: string) => {
      await withFreshToken((tk) => deleteExternalShare(tk, shareId));
      setSharedLinks((prev) => prev.filter((s) => s.share_id !== shareId));
    },
    [withFreshToken]
  );

  const getPagination = useCallback(
    (parentId: string | null, shared?: boolean): PaginationInfo =>
      pageInfo[pageKeyFor(parentId, shared)] ?? { hasMore: false, loading: false },
    [pageInfo]
  );

  const getSharedFolderId = useCallback(
    (folderId: string | null): string | null =>
      folderId !== null ? sharedSubtreeContext(filesRef.current, folderId)?.rootId ?? null : null,
    []
  );

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
  const ensureTrashFolder = useCallback(async (): Promise<string | null> => {
    const known = filesRef.current.find(
      (f) => f.isFolder && f.parentId === null && f.origin === "server" && f.name === TRASH_FOLDER_NAME
    );
    if (known) {
      setTrashFolderId(known.id);
      return known.id;
    }

    if (!authRef.current.token) return null;

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

    const mapped = (listing ?? []).map((r) => mapResource(r, ownerEmailRef.current));
    setFiles((prev) => {
      const next = mergeServerListing(prev, null, mapped, false);
      saveCache(next);
      return next;
    });
    setTrashFolderId(match.resource_id);
    return match.resource_id;
  }, [withFreshToken]);

  useEffect(() => {
    if (!isAuthenticated) {
      setFiles([]);
      setIsLoading(false);
      setTrashFolderId(null);
      setSharedOut([]);
      setSharedLinks([]);
      loadedFoldersRef.current.clear();
      pageStateRef.current.clear();
      setPageInfo({});
      return;
    }

    setIsLoading(true);
    let cancelled = false;

    (async () => {
      let cached: FileItem[] = [];
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) cached = JSON.parse(stored);
      } catch (err) {
        console.error("Failed to read filesystem cache", err);
      }

      const hydrated = await hydrateBlobs(cached);
      if (cancelled) return;
      setFiles(hydrated);
      setIsLoading(false);

      // Pull the live root listing over the cached tree, then make sure Trash exists.
      await loadFolder(null, { force: true });
      if (!cancelled) await ensureTrashFolder();
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loadFolder, ensureTrashFolder]);

  const getDescendantIds = (id: string) => collectDescendantIds(files, id);

  // Optimistic local create; if signed in, also create it server-side and re-sync the
  // parent so the temp id is swapped for the real one.
  const createFolder = (name: string, parentId: string | null): FileItem | null => {
    const safeName = sanitizeName(name);
    if (!safeName) return null;

    const creationInfo = buildCreationInfo(parentId);
    const newFolder: FileItem = {
      id: "folder-" + Date.now() + "-" + randomSuffix(),
      name: safeName,
      isFolder: true,
      parentId,
      size: 0,
      owner: { name: "me", email: ownerEmailRef.current },
      modifiedAt: nowIso(),
      createdAt: nowIso(),
      isStarred: false,
      isDeleted: false,
      type: "folder",
      resourceInfo: creationInfo,
      createdBy: userNameRef.current,
      origin: "local",
    };

    setFiles((prev) => {
      const updated = [...prev, newFolder];
      saveCache(updated);
      return updated;
    });

    const { token: tk } = authRef.current;
    if (tk) {
      // Creating inside a "Shared with me" folder: the API needs shared_folder_id to
      // check the caller's share permissions and write as the folder's owner. It's the
      // id of the folder actually shared with the user (the shared-subtree root), not
      // the immediate parent — the two differ for a nested subfolder.
      const sharedFolderId =
        parentId !== null
          ? sharedSubtreeContext(filesRef.current, parentId)?.rootId ?? null
          : null;
      (async () => {
        try {
          await withFreshToken((t) =>
            apiCreateFolder(t, {
              parentFolderId: parentId,
              folderName: safeName,
              folderInfo: creationInfo,
              sharedFolderId,
            })
          );
          await loadFolder(parentId, { force: true });
        } catch (err) {
          console.warn("Folder create did not sync to API", err);
          // Roll the optimistic row back — nothing retries local folders and
          // fetchFolderPage won't list their children, so a kept row becomes a
          // permanent phantom. Then re-list in case the create actually landed
          // (e.g. a unique-name conflict) so it reappears as a real server row.
          setFiles((prev) => {
            const updated = prev.filter((f) => f.id !== newFolder.id);
            saveCache(updated);
            return updated;
          });
          await loadFolder(parentId, { force: true }).catch(() => {});
        }
      })();
    }

    return newFolder;
  };

  // Resolve a folder chain to real server ids, creating missing links. See the
  // interface doc. Returns the deepest folder id, or null on failure.
  const ensureFolderPath = useCallback(
    async (segments: string[], rootParentId: string | null): Promise<string | null> => {
      let parentId = rootParentId;

      for (const rawSegment of segments) {
        const segment = sanitizeName(rawSegment);
        if (!segment) continue;

        const known = filesRef.current.find(
          (f) => f.isFolder && !f.isDeleted && f.parentId === parentId && f.name === segment
        );
        if (known?.origin === "server") {
          parentId = known.id;
          continue;
        }

        const { token: tk } = authRef.current;
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

        const mapped = (listing ?? []).map((r) => mapResource(r, ownerEmailRef.current));
        setFiles((prev) => {
          const next = mergeServerListing(prev, listParentId, mapped, false);
          saveCache(next);
          return next;
        });
        parentId = match.resource_id;
      }

      return parentId;
    },
    [withFreshToken]
  );

  const addFile = (input: AddFileInput): FileItem => {
    const safeName = sanitizeName(input.name) || "unnamed";

    const newItem: FileItem = {
      id: "file-" + Date.now() + "-" + randomSuffix(),
      name: safeName,
      isFolder: false,
      parentId: input.parentId,
      size: input.size,
      owner: { name: "me", email: ownerEmailRef.current },
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

    setFiles((prev) => {
      // The backend keeps one row per (folder, file_name); mirror that here. If this
      // upload bumped the version, fold the previous content into the version history
      // instead of dropping it; otherwise it's a plain replace.
      const existing = prev.find(
        (f) => !f.isFolder && f.parentId === newItem.parentId && f.name === safeName
      );
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

      const updated = [
        ...prev.filter((f) => !(!f.isFolder && f.parentId === newItem.parentId && f.name === safeName)),
        newItem,
      ];
      saveCache(updated);
      return updated;
    });

    return newItem;
  };

  const renameItem = (id: string, newName: string) => {
    const safeName = sanitizeName(newName);
    if (!safeName) return;
    const target = files.find((f) => f.id === id);
    persist(files.map((f) => (f.id === id ? { ...f, name: safeName, modifiedAt: nowIso() } : f)));

    const { token: tk } = authRef.current;
    if (tk && target?.origin === "server") {
      // edit replaces *_info wholesale — carry the existing info through.
      if (target.isFolder) {
        withFreshToken((t) =>
          apiEditFolder(t, { folderId: id, folderName: safeName, folderInfo: target.resourceInfo })
        ).catch((err) => console.warn("Folder rename did not sync to API", err));
      } else if (target.fileId) {
        withFreshToken((t) =>
          apiUpdateFileInfo(t, { file_id: target.fileId!, file_name: safeName, file_info: target.resourceInfo ?? {} })
        ).catch((err) => console.warn("File rename did not sync to API", err));
      }
    }
  };

  // Merge a UI patch (starred / color / icon) into an item's resource_info.
  const mergeUi = (f: FileItem, patch: Partial<ResourceUiInfo>): Record<string, unknown> => {
    const info = (f.resourceInfo ?? {}) as ResourceInfo;
    return { ...info, ui: { ...(info.ui ?? {}), ...patch } };
  };

  // Persist a resource_info.ui change for a server folder (PATCH /folders/edit,
  // which replaces folder_info — so send the whole merged object).
  const patchFolderUi = (id: string, patch: Partial<ResourceUiInfo>) => {
    const target = filesRef.current.find((f) => f.id === id);
    if (!target?.isFolder || target.origin !== "server" || !authRef.current.token) return;
    const folderInfo = mergeUi(target, patch);
    withFreshToken((t) => apiEditFolder(t, { folderId: id, folderName: target.name, folderInfo })).catch((err) =>
      console.warn("Folder appearance did not sync to API", err)
    );
  };

  const toggleStar = (id: string) => {
    const next = !files.find((f) => f.id === id)?.isStarred;
    persist(files.map((f) => (f.id === id ? { ...f, isStarred: next, resourceInfo: mergeUi(f, { starred: next }) } : f)));
    patchFolderUi(id, { starred: next });
  };

  const starItems = (ids: string[]) => {
    persist(
      files.map((f) => (ids.includes(f.id) ? { ...f, isStarred: true, resourceInfo: mergeUi(f, { starred: true }) } : f))
    );
    ids.forEach((id) => patchFolderUi(id, { starred: true }));
  };

  // Folder colour / icon. Pass null to clear either.
  const setFolderStyle = (id: string, style: { color?: string | null; icon?: string | null }) => {
    const patch: Partial<ResourceUiInfo> = {};
    if ("color" in style) patch.color = style.color ?? undefined;
    if ("icon" in style) patch.icon = style.icon ?? undefined;
    persist(
      files.map((f) =>
        f.id === id
          ? {
              ...f,
              color: "color" in style ? style.color ?? undefined : f.color,
              icon: "icon" in style ? style.icon ?? undefined : f.icon,
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
  const trashItems = (ids: string[]) => {
    const trashId = trashFolderIdRef.current;
    const targets = new Set(ids);
    const descendantIds = new Set(ids.flatMap((id) => getDescendantIds(id)));
    const roots = files.filter((f) => targets.has(f.id));
    const parentNameById = new Map(files.map((f) => [f.id, f.name]));

    const trashInfoFor = (f: FileItem): FolderTrashInfo => ({
      trashed_from: f.parentId,
      trashed_from_name: f.parentId ? parentNameById.get(f.parentId) : undefined,
      trashed_by: authRef.current.userId ?? undefined,
      trashed_by_name: userNameRef.current,
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

    if (authRef.current.token) {
      roots
        .filter((f) => f.isFolder && f.origin === "server")
        .forEach((f) => {
          const folderInfo: ResourceInfo = { ...(f.resourceInfo ?? {}), trash_info: trashInfoFor(f) };
          withFreshToken(async (t) => {
            await apiEditFolder(t, { folderId: f.id, folderName: f.name, folderInfo });
            if (trashId) await apiMoveFolder(t, { folderId: f.id, newParentFolderId: trashId });
          }).catch((err) => console.warn("Trash did not sync to API", err));
        });
    }
  };

  const restoreItems = (ids: string[]) => {
    const targets = new Set(ids);
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

    if (authRef.current.token) {
      roots
        .filter((f) => f.isFolder && f.origin === "server")
        .forEach((f) => {
          const folderInfo = withoutTrashInfo(f.resourceInfo);
          const restoreTo = f.trashedFrom ?? null;
          withFreshToken(async (t) => {
            await apiEditFolder(t, { folderId: f.id, folderName: f.name, folderInfo });
            await apiMoveFolder(t, { folderId: f.id, newParentFolderId: restoreTo });
          }).catch((err) => console.warn("Restore did not sync to API", err));
        });
    }
  };

  const permanentDeleteItems = (ids: string[]) => {
    const allIds = new Set(ids.flatMap((id) => [id, ...getDescendantIds(id)]));
    persist(files.filter((f) => !allIds.has(f.id)));
  };

  const moveItems = (ids: string[], newParentId: string | null): { moved: number; blocked: number } => {
    let moved = 0;
    let blocked = 0;
    const movedServerFolderIds: string[] = [];
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
      item.parentId = newParentId;
      item.modifiedAt = nowIso();
      moved++;
      if (item.isFolder && item.origin === "server") movedServerFolderIds.push(id);
    }

    if (moved > 0) persist(next);

    const { token: tk } = authRef.current;
    if (tk && movedServerFolderIds.length > 0) {
      movedServerFolderIds.forEach((folderId) => {
        withFreshToken((t) =>
          apiMoveFolder(t, { folderId, newParentFolderId: newParentId })
        ).catch((err) => console.warn("Folder move did not sync to API", err));
      });
    }

    return { moved, blocked };
  };

  const copyItem = (id: string, newParentId: string | null): { copied: number; blocked: boolean } => {
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

  const updateFileContent = async (id: string, blob: Blob): Promise<void> => {
    const storageKey = generateStorageKey();
    await putBlob(storageKey, blob);
    const blobUrl = URL.createObjectURL(blob);
    setFiles((prev) => {
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

  const restoreVersion = (id: string, versionId: string) => {
    setFiles((prev) => {
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

  const setShareSettings = (id: string, settings: ShareSettings) => {
    setFiles((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, share: settings } : f));
      saveCache(updated);
      return updated;
    });
  };

  const clearShareSettings = (id: string) => {
    setFiles((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, share: undefined } : f));
      saveCache(updated);
      return updated;
    });
  };

  return (
    <FileSystemContext.Provider
      value={{
        files,
        isLoading,
        remoteError,
        loadFolder,
        loadMoreFolder,
        loadSharedFolders,
        loadMoreSharedFolders,
        sharedOut,
        loadSharedOut,
        sharedLinks,
        loadSharedLinks,
        revokeSharedLink,
        getPagination,
        getSharedFolderId,
        createFolder,
        ensureFolderPath,
        trashFolderId,
        addFile,
        renameItem,
        toggleStar,
        starItems,
        setFolderStyle,
        trashItems,
        restoreItems,
        permanentDeleteItems,
        moveItems,
        copyItem,
        updateFileContent,
        restoreVersion,
        setShareSettings,
        clearShareSettings,
        getDescendantIds,
      }}
    >
      {children}
    </FileSystemContext.Provider>
  );
};

export const useFileSystem = () => {
  const ctx = useContext(FileSystemContext);
  if (!ctx) throw new Error("useFileSystem must be used within a FileSystemProvider");
  return ctx;
};
