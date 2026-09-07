import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { FileItem, FileVersion, ShareSettings } from "../types/file";
import { SHARED_ROOT_ID } from "../types/file";
import type { BackendResource, InternalSharedResource } from "@yfs/service";
import {
  HttpError,
  listRootFolders,
  listFolderChildren,
  createFolder as apiCreateFolder,
  editFolder as apiEditFolder,
  moveFolder as apiMoveFolder,
  listSharingIn,
  getUserById,
} from "@yfs/service";
import { sanitizeName, categorizeByName } from "../utils/fileType";
import { generateStorageKey, getBlob, putBlob } from "../services/blobStore";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "yfs_fs_cache";
const ROOT_KEY = "__root__";

export interface AddFileInput {
  name: string;
  parentId: string | null;
  size: number;
  type: FileItem["type"];
  extension?: string;
  storageKey: string;
  blob: Blob;
}

interface FileSystemContextType {
  files: FileItem[];
  isLoading: boolean;
  remoteError: string | null;
  // Fetches a folder's direct children from YFS-Main-API and merges them in.
  // `parentId: null` = the user's root. Cached per folder unless `force` is set.
  loadFolder: (parentId: string | null, opts?: { force?: boolean }) => Promise<void>;
  // Fetches folders shared with me (GET /share/internal/list/sharing-in) into the
  // SHARED_ROOT_ID bucket. Cached unless `force` is set.
  loadSharedFolders: (opts?: { force?: boolean }) => Promise<void>;
  createFolder: (name: string, parentId: string | null) => FileItem | null;
  addFile: (input: AddFileInput) => FileItem;
  renameItem: (id: string, newName: string) => void;
  toggleStar: (id: string) => void;
  starItems: (ids: string[]) => void;
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

// Map a raw API resource (folder or file) into the app's FileItem shape.
const mapResource = (r: BackendResource, ownerEmail: string): FileItem => {
  if (r.is_resource_folder) {
    return {
      id: r.resource_id,
      name: r.resource_name,
      isFolder: true,
      parentId: r.parent_folder_id ?? null,
      size: r.total_resource_size ?? 0,
      owner: { name: "me", email: ownerEmail },
      modifiedAt: r.updated_at,
      createdAt: r.created_at,
      isStarred: false,
      isDeleted: false,
      type: "folder",
      origin: "server",
    };
  }

  const { type, extension } = categorizeByName(r.resource_name);
  return {
    id: r.resource_id,
    name: r.resource_name,
    isFolder: false,
    parentId: r.parent_folder_id ?? null,
    size: r.total_resource_size ?? 0,
    owner: { name: "me", email: ownerEmail },
    modifiedAt: r.updated_at,
    createdAt: r.created_at,
    isStarred: false,
    isDeleted: false,
    type,
    extension: extension || undefined,
    origin: "server",
  };
};

// Map a "shared with me" folder into a FileItem parked under SHARED_ROOT_ID.
const mapSharedResource = (r: InternalSharedResource): FileItem => ({
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
});

// Merge a fresh server listing of one folder into the current tree, preserving any
// client-only state (stars, trash, shares, uploaded blobs) and reconciling optimistic
// folders created offline against their now-real server ids.
const mergeServerListing = (prev: FileItem[], parentId: string | null, incoming: FileItem[]): FileItem[] => {
  // 1. Match optimistic local folders to their server counterparts by parent + name.
  const idRemap = new Map<string, string>();
  for (const res of incoming) {
    if (!res.isFolder) continue;
    const local = prev.find(
      (f) => f.isFolder && f.origin !== "server" && f.parentId === res.parentId && f.name === res.name && f.id !== res.id
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
      isStarred: f.isStarred,
      isDeleted: f.isDeleted,
      share: f.share,
      versions: f.versions,
      blobUrl: f.blobUrl,
      storageKey: f.storageKey,
    };
  });
  for (const res of incoming) {
    if (!workingIds.has(res.id)) merged.push(res);
  }

  // 3. Drop server rows that were children of this folder but have vanished server-side
  //    (deleted elsewhere) — unless they carry client-only state worth keeping.
  return merged.filter((f) => {
    if (f.origin !== "server") return true;
    if (f.parentId !== parentId) return true;
    if (incomingIds.has(f.id)) return true;
    if (f.isStarred || f.isDeleted || f.share) return true;
    return false;
  });
};

export const FileSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token, userId, user, refreshAccessToken } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  // Refs so async callbacks always see current values without re-creating themselves.
  const authRef = useRef({ token, userId, refreshAccessToken });
  authRef.current = { token, userId, refreshAccessToken };
  const filesRef = useRef<FileItem[]>(files);
  filesRef.current = files;
  const ownerEmailRef = useRef(user?.email || "me@example.com");
  ownerEmailRef.current = user?.email || "me@example.com";
  const loadedFoldersRef = useRef<Set<string>>(new Set());

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

  const loadFolder = useCallback(
    async (parentId: string | null, opts?: { force?: boolean }) => {
      if (!authRef.current.token) return;
      const key = parentId ?? ROOT_KEY;
      if (!opts?.force && loadedFoldersRef.current.has(key)) return;

      // Client-only folders (created offline, not yet synced) have no server listing.
      if (parentId !== null) {
        const folder = filesRef.current.find((f) => f.id === parentId);
        if (folder && folder.origin !== "server") return;
      }

      try {
        const resources = await withFreshToken((tk) =>
          parentId === null ? listRootFolders(tk) : listFolderChildren(tk, parentId)
        );
        if (!resources) return;

        loadedFoldersRef.current.add(key);
        setRemoteError(null);
        const mapped = resources.map((r) => mapResource(r, ownerEmailRef.current));
        setFiles((prev) => {
          const next = mergeServerListing(prev, parentId, mapped);
          saveCache(next);
          return next;
        });
      } catch (err) {
        console.warn("Failed to load folder from YFS-Main-API", err);
        setRemoteError(err instanceof Error ? err.message : "Could not reach the file service");
      }
    },
    [withFreshToken]
  );

  const loadSharedFolders = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!authRef.current.token) return;
      if (!opts?.force && loadedFoldersRef.current.has(SHARED_ROOT_ID)) return;

      try {
        const shared = await withFreshToken((tk) => listSharingIn(tk));
        if (!shared) return;

        loadedFoldersRef.current.add(SHARED_ROOT_ID);
        setRemoteError(null);

        // Resolve each owner's email once so the list shows who shared the folder.
        const ownerEmails = new Map<string, string>();
        await Promise.all(
          [...new Set(shared.map((s) => s.user_id))].map(async (ownerId) => {
            try {
              const owner = await withFreshToken((tk) => getUserById(tk, ownerId));
              if (owner) ownerEmails.set(ownerId, owner.email);
            } catch {
              /* leave unresolved */
            }
          })
        );

        // Shared-in folders are read-only leaves — no client state to preserve, so
        // just swap the whole bucket for the fresh listing.
        const mapped = shared.map((s) => {
          const item = mapSharedResource(s);
          const email = ownerEmails.get(s.user_id);
          if (email) {
            item.owner = { name: email.split("@")[0], email };
            if (item.sharedIn) item.sharedIn.ownerEmail = email;
          }
          return item;
        });
        setFiles((prev) => {
          const next = [...prev.filter((f) => f.origin !== "shared"), ...mapped];
          saveCache(next);
          return next;
        });
      } catch (err) {
        console.warn("Failed to load shared folders from YFS-Main-API", err);
        setRemoteError(err instanceof Error ? err.message : "Could not reach the file service");
      }
    },
    [withFreshToken]
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

  useEffect(() => {
    if (!isAuthenticated) {
      setFiles([]);
      setIsLoading(false);
      loadedFoldersRef.current.clear();
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

      // Pull the live root listing over the cached tree.
      await loadFolder(null, { force: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loadFolder]);

  const getDescendantIds = (id: string) => collectDescendantIds(files, id);

  // Optimistic local create; if signed in, also create it server-side and re-sync the
  // parent so the temp id is swapped for the real one.
  const createFolder = (name: string, parentId: string | null): FileItem | null => {
    const safeName = sanitizeName(name);
    if (!safeName) return null;

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
      origin: "local",
    };

    setFiles((prev) => {
      const updated = [...prev, newFolder];
      saveCache(updated);
      return updated;
    });

    const { token: tk, userId: uid } = authRef.current;
    if (tk && uid) {
      (async () => {
        try {
          await withFreshToken((t) =>
            apiCreateFolder(t, { userId: uid, parentFolderId: parentId, folderName: safeName })
          );
          await loadFolder(parentId, { force: true });
        } catch (err) {
          console.warn("Folder create did not sync to API", err);
        }
      })();
    }

    return newFolder;
  };

  const addFile = (input: AddFileInput): FileItem => {
    const newItem: FileItem = {
      id: "file-" + Date.now() + "-" + randomSuffix(),
      name: sanitizeName(input.name) || "unnamed",
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
      origin: "local",
    };

    setFiles((prev) => {
      const updated = [...prev, newItem];
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

    const { userId: uid } = authRef.current;
    if (uid && target?.isFolder && target.origin === "server") {
      withFreshToken((t) => apiEditFolder(t, { userId: uid, folderId: id, folderName: safeName })).catch((err) =>
        console.warn("Folder rename did not sync to API", err)
      );
    }
  };

  const toggleStar = (id: string) => {
    persist(files.map((f) => (f.id === id ? { ...f, isStarred: !f.isStarred } : f)));
  };

  const starItems = (ids: string[]) => {
    persist(files.map((f) => (ids.includes(f.id) ? { ...f, isStarred: true } : f)));
  };

  const trashItems = (ids: string[]) => {
    const allIds = new Set(ids.flatMap((id) => [id, ...getDescendantIds(id)]));
    persist(files.map((f) => (allIds.has(f.id) ? { ...f, isDeleted: true } : f)));
  };

  const restoreItems = (ids: string[]) => {
    const allIds = new Set(ids.flatMap((id) => [id, ...getDescendantIds(id)]));
    persist(files.map((f) => (allIds.has(f.id) ? { ...f, isDeleted: false } : f)));
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

    const { userId: uid } = authRef.current;
    if (uid && movedServerFolderIds.length > 0) {
      movedServerFolderIds.forEach((folderId) => {
        withFreshToken((t) =>
          apiMoveFolder(t, { userId: uid, folderId, newParentFolderId: newParentId })
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
        loadSharedFolders,
        createFolder,
        addFile,
        renameItem,
        toggleStar,
        starItems,
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
