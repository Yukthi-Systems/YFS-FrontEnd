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
import {
  filesAtom,
  isLoadingAtom,
  remoteErrorAtom,
  pageInfoAtom,
  trashFolderIdAtom,
  idRemapAtom,
  sharedOutAtom,
  sharedOutLoadingAtom,
  sharedOutLoadedAtom,
  sharedLinksAtom,
  sharedLinksLoadingAtom,
  sharedLinksLoadedAtom,
  type AddFileInput,
} from "../atoms/fileSystem";

// Singleton file tree (drive, shared, trash) kept in sync with YFS-Main-API; read via hooks/useFileSystem.ts.

const store = getDefaultStore();

const STORAGE_KEY = "yfs_fs_cache";
const ROOT_KEY = "__root__";
// Real root folder holding trashed items; created on first login.
const TRASH_FOLDER_NAME = "Trash";

interface AuthSnapshot {
  token: string | null;
  userId: string | null;
  refreshAccessToken: () => Promise<string | null>;
}
let authSnapshot: AuthSnapshot = { token: null, userId: null, refreshAccessToken: async () => null };
let ownerEmail = "";
let userName: string | undefined;

export function setAuthSnapshot(next: AuthSnapshot) {
  authSnapshot = next;
}

export function setUserSnapshot(email: string | undefined, name: string | undefined) {
  ownerEmail = email || "";
  userName = name;
}

// Pagination bookkeeping per folder; request caching itself lives in queryClient.
const pageState = new Map<string, { loaded: number; hasMore: boolean }>();

// Ids with an in-flight move/trash/restore; listings must not overwrite their optimistic state.
const pendingSyncIds = new Set<string>();

const trackPendingSync = <T,>(id: string, promise: Promise<T>): Promise<T> => {
  pendingSyncIds.add(id);
  return promise.finally(() => pendingSyncIds.delete(id));
};

// Token unavailable (authStore already handled it) — abort quietly instead of surfacing an error.
class AuthUnavailableError extends Error {}

// One query per (folder, offset); staleTime Infinity, so "force" invalidates explicitly.
const folderQueryKey = (key: string, offset: number) => ["folder", key, offset] as const;

const nowIso = () => new Date().toISOString();
const randomSuffix = () => Math.random().toString(36).slice(2, 10);

// Optimistic rows use temp ids until the server UUID arrives; the API 400s on non-UUIDs.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isServerId = (id: string | null): boolean => id === null || UUID_RE.test(id);

interface SharedSubtree {
  rootId: string;
  ownerUserId: string;
  ownerEmail?: string;
  permissions: InternalSharePermissions;
}

// Finds the "Shared with me" root above a folder, or null if it isn't shared.
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

const mapResource = (r: BackendResource, ownerEmailForRow: string): FileItem => {
  const info = (r.resource_info ?? undefined) as ResourceInfo | undefined;
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
    color: ui?.color,
    icon: ui?.icon,
    createdBy: creatorName,
    isLocked: Boolean((r as { is_locked?: boolean }).is_locked ?? (info as { is_locked?: boolean } | undefined)?.is_locked),
    // Trash state is set by fetchFolderPage's inTrash check.
    isDeleted: false,
    resourceInfo: info,
    origin: "server" as const,
  };

  if (r.is_resource_folder) {
    return { ...common, isFolder: true, type: "folder" };
  }

  const { type, extension } = categorizeByName(r.resource_name);
  // resource_id is the file_id for file rows.
  return { ...common, isFolder: false, type, extension: extension || undefined, fileId: r.resource_id };
};

const mapSharedResource = (r: InternalSharedResource): FileItem => {
  const info = (r.resource_info ?? undefined) as ResourceInfo | undefined;
  const isFolder = r.is_resource_folder !== false;
  const { type, extension } = isFolder ? { type: "folder" as const, extension: undefined } : categorizeByName(r.resource_name);
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
    color: ui?.color,
    icon: ui?.icon,
    isDeleted: false,
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

// Resolves creator names from creation_info.user_id, cached per user.
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
          if (creatorIdOf(item) !== userId) continue;
          item.createdBy = name;
          item.createdByEmail = user.email;
        }
      } catch {
      }
    })
  );
};

// How long an unsynced optimistic folder survives a listing that doesn't include it.
const LOCAL_FOLDER_GRACE_MS = 30_000;

// Merges a server listing into the tree, keeping client-only state and swapping temp ids.
const mergeServerListing = (
  prev: FileItem[],
  parentId: string | null,
  incoming: FileItem[],
  mode: "append" | "force" | "initial" = "initial"
): FileItem[] => {
  // Match optimistic rows to server rows by kind + parent + name.
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
    store.set(idRemapAtom, (prev) => ({ ...prev, ...Object.fromEntries(idRemap) }));
    working = prev
      .filter((f) => !idRemap.has(f.id))
      .map((f) => (f.parentId && idRemap.has(f.parentId) ? { ...f, parentId: idRemap.get(f.parentId)! } : f));
  }

  const workingIds = new Set(working.map((f) => f.id));
  const incomingIds = new Set(incoming.map((f) => f.id));

  // Upsert incoming rows; rows with a pending mutation keep their optimistic fields.
  const merged: FileItem[] = working.map((f) => {
    if (pendingSyncIds.has(f.id)) return f;
    const res = incoming.find((r) => r.id === f.id);
    if (!res) return f;

    return {
      ...res,
      isDeleted: res.isDeleted,
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

  if (mode !== "force") return merged;

  // Force mode: drop children missing from the listing, except shared rows, pending mutations and fresh optimistic folders.
  return merged.filter((f) => {
    if (f.parentId !== parentId) return true;
    if (incomingIds.has(f.id)) return true;
    if (f.share || pendingSyncIds.has(f.id)) return true;
    if (f.origin === "server") return false;
    if (f.origin === "local" && f.isFolder && f.id.startsWith("folder-")) {
      const age = Date.now() - Date.parse(f.createdAt);
      return Number.isFinite(age) && age <= LOCAL_FOLDER_GRACE_MS;
    }
    return true;
  });
};

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

// Best-guess MIME type; we only track a coarse category.
export const fileTypeGuess = (item: FileItem): string => (item.type === "other" ? "application/octet-stream" : item.type);

// Stamped into folder_info/file_info; drives the "Created by" column.
export const buildCreationInfo = (): ResourceInfo => ({
  creation_info: {
    user_id: authSnapshot.userId ?? undefined,
  },
});

// Runs an API call, refreshing the token once on 401/400.
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

// Fire-and-forget write through the MutationCache; no rollback except createFolder's own.
const runMutation = <TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  variables: TVariables,
  onError: (err: unknown) => void
) => {
  const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn, onError });
  mutation.execute(variables).catch(() => {
    // onError already handled it; avoid an unhandled rejection.
  });
};

const notifySyncFailed = (context: string, fallback: string) => (err: unknown) => {
  console.warn(context, err);
  showToast(err instanceof Error ? err.message : fallback, "error");
};

const inFlightFolderPages = new Set<string>();

// "initial" uses cache, "force" refetches page 1, "append" loads the next page.
const fetchFolderPage = async (parentId: string | null, mode: "initial" | "force" | "append") => {
  if (!authSnapshot.token) return;
  const key = parentId ?? ROOT_KEY;

  // Folders inside a share are listed through the share endpoint.
  const currentFiles = store.get(filesAtom);
  const shared = parentId !== null ? sharedSubtreeContext(currentFiles, parentId) : null;

  // Unsynced local folders have no server listing.
  if (parentId !== null && !shared) {
    const folder = currentFiles.find((f) => f.id === parentId);
    if (folder && folder.origin !== "server") return;
  }
  if (!isServerId(parentId)) return;

  const state = pageState.get(key) ?? { loaded: 0, hasMore: true };
  if (mode === "append" && !state.hasMore) return;
  if (mode === "initial" && state.loaded > 0) return;

  if (inFlightFolderPages.has(key) && mode !== "force") return;
  inFlightFolderPages.add(key);

  const offset = mode === "append" ? state.loaded : 0;
  const queryKey = folderQueryKey(key, offset);
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

    // Anything under Trash, at any depth, is trashed.
    const inTrash =
      parentId !== null &&
      (parentId === store.get(trashFolderIdAtom) ||
        (store.get(filesAtom).find((f) => f.id === parentId)?.isDeleted ?? false));
    const mapped = resources.map((r) => {
      const item = mapResource(r, ownerEmail);
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
        }
      })
    );

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

// One row per recipient, so dedupe by folder id.
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
            // Presence-only sentinel; the real hash never reaches the client.
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

// blob: URLs don't survive a reload, so rebuild them from IndexedDB.
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

const ensureTrashFolder = async (): Promise<string | null> => {
  const known = store
    .get(filesAtom)
    .find((f) => f.isFolder && f.parentId === null && f.origin === "server" && f.name === TRASH_FOLDER_NAME);
  if (known) {
    store.set(trashFolderIdAtom, known.id);
    return known.id;
  }

  if (!authSnapshot.token) return null;

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
  // Cached pages never go stale, so clear them for the next user.
  queryClient.removeQueries({ queryKey: ["folder"] });
  queryClient.removeQueries({ queryKey: SHARED_OUT_QUERY_KEY });
  queryClient.removeQueries({ queryKey: SHARED_LINKS_QUERY_KEY });
  pageState.clear();
  store.set(pageInfoAtom, {});
};

// Boot on sign-in; `signal.cancelled` abandons a stale run.
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

  await loadFolder(null, { force: true });
  if (!signal.cancelled) await ensureTrashFolder();
};

// Optimistic create, then sync server-side and swap in the real id.
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
    isDeleted: false,
    type: "folder",
    resourceInfo: creationInfo,
    createdBy: userName,
    createdByEmail: ownerEmail,
    origin: "local",
  };

  store.set(filesAtom, (prev) => {
    const updated = [...prev, newFolder];
    saveCache(updated);
    return updated;
  });

  const tk = authSnapshot.token;
  if (tk) {
    // Parent is still a temp id; the request would 400.
    if (!isServerId(parentId)) {
      showToast("That folder is still being saved — try again in a moment", "error");
      return newFolder;
    }
    // shared_folder_id is the share root, not the immediate parent.
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
        // Roll back (nothing retries local folders), then re-list in case the create actually landed.
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

// Resolves a folder path to server ids, creating missing folders. Returns the deepest id, or null.
export const ensureFolderPath = async (segments: string[], rootParentId: string | null): Promise<string | null> => {
  if (!isServerId(rootParentId)) {
    showToast("That folder is still being saved — try again in a moment", "error");
    return null;
  }
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
      const local = known ?? createFolder(segment, parentId);
      if (!local) return null;
      parentId = local.id;
      continue;
    }

    // A name conflict means it already exists; re-list to learn its id.
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
    isDeleted: false,
    type: input.type,
    extension: input.extension,
    blobUrl: URL.createObjectURL(input.blob),
    storageKey: input.storageKey,
    fileId: input.fileId,
    version: input.version,
    resourceInfo: buildCreationInfo(),
    createdBy: userName,
    createdByEmail: ownerEmail,
    origin: "local",
  };

  store.set(filesAtom, (prev) => {
    // One row per (folder, name); a version bump moves the old content into history.
    const existing = prev.find((f) => !f.isFolder && f.parentId === newItem.parentId && f.name === safeName);
    if (existing) {
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

const sharedWrite = (id: string): { sharedFolderId: string; perms: InternalSharePermissions } | null => {
  const ctx = sharedSubtreeContext(store.get(filesAtom), id);
  return ctx ? { sharedFolderId: ctx.rootId, perms: ctx.permissions } : null;
};

export const renameItem = (id: string, newName: string) => {
  const safeName = sanitizeName(newName);
  if (!safeName) return;
  const files = store.get(filesAtom);
  const target = files.find((f) => f.id === id);
  if (!target || target.isDeleted || isItemLocked(target)) return;
  persist(files.map((f) => (f.id === id ? { ...f, name: safeName, modifiedAt: nowIso() } : f)));

  const tk = authSnapshot.token;
  if (!tk || !target) return;
  const shared = sharedWrite(id);

  // Edit replaces *_info wholesale, so carry the existing info through.
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

// Merged into the existing info blob; empty string clears it.
export const setItemDescription = (id: string, description: string) => {
  const files = store.get(filesAtom);
  const target = files.find((f) => f.id === id);
  if (!target || isItemLocked(target)) return;

  const trimmed = description.trim();
  const info = { ...((target.resourceInfo ?? {}) as ResourceInfo) };
  if (trimmed) info.description = trimmed;
  else delete info.description;

  persist(files.map((f) => (f.id === id ? { ...f, resourceInfo: info, modifiedAt: nowIso() } : f)));

  const tk = authSnapshot.token;
  if (!tk) return;
  const shared = sharedWrite(id);
  if (shared && !shared.perms.can_update) return; // no edit permission — optimistic only

  if (target.isFolder && (target.origin === "server" || target.origin === "shared")) {
    runMutation(
      () =>
        withFreshToken((t) =>
          apiEditFolder(t, {
            folderId: id,
            folderName: target.name,
            folderInfo: info,
            sharedFolderId: shared?.sharedFolderId ?? null,
          })
        ),
      { id },
      notifySyncFailed("Folder description did not sync to API", "Couldn't save the description")
    );
  } else if (!target.isFolder && target.origin === "server" && target.fileId) {
    runMutation(
      () =>
        withFreshToken((t) =>
          apiUpdateFileInfo(t, {
            folder_id: target.parentId!,
            file_id: target.fileId!,
            shared_folder_id: shared?.sharedFolderId ?? null,
            file_name: target.name,
            file_info: info,
            file_type: fileTypeGuess(target),
            file_version: target.version ?? 1,
            expected_file_size: target.size,
          })
        ),
      { id },
      notifySyncFailed("File description did not sync to API", "Couldn't save the description")
    );
  }
};

const mergeUi = (f: FileItem, patch: Partial<ResourceUiInfo>): Record<string, unknown> => {
  const info = (f.resourceInfo ?? {}) as ResourceInfo;
  return { ...info, ui: { ...(info.ui ?? {}), ...patch } };
};

// PATCH /folders/edit replaces folder_info, so send the whole merged object.
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

export const setFolderStyle = (id: string, style: { color?: string | null; icon?: string | null }) => {
  const patch: Partial<ResourceUiInfo> = {};
  if ("color" in style) patch.color = style.color ?? undefined;
  if ("icon" in style) patch.icon = style.icon ?? undefined;
  const files = store.get(filesAtom);
  if (files.find((f) => f.id === id)?.isDeleted) return;
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

// Trash is a folder: trashing and restoring are moves.
export const trashItems = (ids: string[]) => {
  const trashId = store.get(trashFolderIdAtom);
  if (!trashId) return;
  moveItems(ids, trashId);
};

export const restoreItems = (
  ids: string[],
  destinationId: string | null
): { moved: number; blocked: number; unsupported: number } => moveItems(ids, destinationId);

// Not optimistic — items disappear only once the server confirms.
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

  const localOnly = targets.filter((f) => f.origin !== "server" && f.origin !== "shared");
  const removeIds = new Set(localOnly.flatMap((f) => [f.id, ...getDescendantIds(f.id)]));

  const serverFolders = targets.filter((f) => f.isFolder && (f.origin === "server" || f.origin === "shared"));
  // Folder deletes purge their subtree server-side; don't delete descendants separately.
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

// Deletes an older version (never the current one).
export const deleteFileVersion = async (item: FileItem, version: number): Promise<boolean> => {
  if (item.isFolder || !item.fileId || !item.parentId) return false;
  if (isItemLocked(item)) {
    showToast("File is locked and its versions cannot be deleted", "error");
    return false;
  }
  // The server never allows deleting version 1 on its own.
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
  const trashId = store.get(trashFolderIdAtom);
  const intoTrash =
    newParentId !== null && (newParentId === trashId || !!next.find((f) => f.id === newParentId)?.isDeleted);
  const movedIds: string[] = [];

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
    if (!isServerId(newParentId)) {
      blocked++;
      continue;
    }

    // PUT /files/move needs a destination folder; files can't move to root.
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
    item.isDeleted = intoTrash;
    movedIds.push(id);
    moved++;
  }

  if (moved > 0) {
    const subtree = new Set(movedIds.flatMap((id) => getDescendantIds(id)));
    for (const f of next) if (subtree.has(f.id)) f.isDeleted = intoTrash;
    persist(next);
  }

  const tk = authSnapshot.token;
  if (tk) {
    folderMoves.forEach(({ id, sharedFolderId }) => {
      runMutation(
        () => trackPendingSync(id, withFreshToken((t) => apiMoveFolder(t, { folderId: id, newParentFolderId: newParentId, sharedFolderId }))),
        { id, sharedFolderId },
        notifySyncFailed("Folder move did not sync to API", "Couldn't move that folder")
      );
    });
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
