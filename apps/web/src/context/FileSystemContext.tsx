import React, { createContext, useContext, useEffect, useState } from "react";
import type { FileItem, FileVersion, ShareSettings } from "../types/file";
import { SEED_FILES } from "../data/seedFiles";
import { attachSeedContent } from "../data/seedContent";
import { sanitizeName } from "../utils/fileType";
import { generateStorageKey, getBlob, putBlob } from "../services/blobStore";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "yfs_files";

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

export const FileSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoading(true);

    (async () => {
      let loaded: FileItem[];
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          loaded = JSON.parse(stored);
        } else {
          loaded = await attachSeedContent(SEED_FILES);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
        }
      } catch (err) {
        console.error("Failed to load user filesystem", err);
        loaded = SEED_FILES;
      }

      // blob: URLs don't survive a reload — regenerate them from the real bytes kept in
      // IndexedDB for anything that has a storageKey (seeded demo items have none and
      // keep their existing "no content" placeholder behavior). Past versions carry their
      // own storageKey too and are hydrated the same way.
      const hydrateBlobUrl = async (storageKey: string | undefined, label: string): Promise<string | undefined> => {
        if (!storageKey) return undefined;
        try {
          const blob = await getBlob(storageKey);
          return blob ? URL.createObjectURL(blob) : undefined;
        } catch (err) {
          console.error("Failed to hydrate blob for", label, err);
          return undefined;
        }
      };

      const hydrated = await Promise.all(
        loaded.map(async (item) => {
          const blobUrl = await hydrateBlobUrl(item.storageKey, item.name);
          const versions = item.versions
            ? await Promise.all(
                item.versions.map(async (v) => ({ ...v, blobUrl: await hydrateBlobUrl(v.storageKey, `${item.name} (version)`) }))
              )
            : undefined;
          return { ...item, blobUrl, versions };
        })
      );

      setFiles(hydrated);
      setIsLoading(false);
    })();
  }, [isAuthenticated]);

  const persist = (updated: FileItem[]) => {
    setFiles(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const getDescendantIds = (id: string) => collectDescendantIds(files, id);

  // Functional update (not persist([...files, ...])) because nested-folder upload calls
  // this repeatedly in a synchronous chain to build out a path — persist() would read the
  // same stale `files` closure each time and only the last call's folder would survive.
  const createFolder = (name: string, parentId: string | null): FileItem | null => {
    const safeName = sanitizeName(name);
    if (!safeName) return null;

    const newFolder: FileItem = {
      id: "folder-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10),
      name: safeName,
      isFolder: true,
      parentId,
      size: 0,
      owner: { name: "me", email: "me@yukthi.net" },
      modifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isStarred: false,
      isDeleted: false,
      type: "folder",
    };

    setFiles((prev) => {
      const updated = [...prev, newFolder];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    return newFolder;
  };

  // Registers a file whose bytes are already persisted (by the upload queue, via
  // uploadClient -> blobStore). Uses a functional state update since uploads complete
  // asynchronously and several can finish in close succession — each must append to
  // whatever the current array is, not a copy captured when the upload started.
  const addFile = (input: AddFileInput): FileItem => {
    const newItem: FileItem = {
      id: "file-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10),
      name: sanitizeName(input.name) || "unnamed",
      isFolder: false,
      parentId: input.parentId,
      size: input.size,
      owner: { name: "me", email: "me@yukthi.net" },
      modifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isStarred: false,
      isDeleted: false,
      type: input.type,
      extension: input.extension,
      blobUrl: URL.createObjectURL(input.blob),
      storageKey: input.storageKey,
    };

    setFiles((prev) => {
      const updated = [...prev, newItem];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    return newItem;
  };

  const renameItem = (id: string, newName: string) => {
    const safeName = sanitizeName(newName);
    if (!safeName) return;
    persist(
      files.map((f) => (f.id === id ? { ...f, name: safeName, modifiedAt: new Date().toISOString() } : f))
    );
  };

  const toggleStar = (id: string) => {
    persist(files.map((f) => (f.id === id ? { ...f, isStarred: !f.isStarred } : f)));
  };

  const starItems = (ids: string[]) => {
    persist(files.map((f) => (ids.includes(f.id) ? { ...f, isStarred: true } : f)));
  };

  // Trashing/restoring a folder cascades to all its descendants so they don't
  // become orphaned (still live, still counted, invisible except via Trash).
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
      item.modifiedAt = new Date().toISOString();
      moved++;
    }

    if (moved > 0) persist(next);
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
    const now = new Date().toISOString();
    const makeCopyId = (originalId: string) => {
      const copyId = originalId + "-copy-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
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
    };

    const descendantIds = getDescendantIds(id);
    const descendantCopies: FileItem[] = descendantIds.map((descId) => {
      const desc = files.find((f) => f.id === descId)!;
      return { ...desc, id: makeCopyId(descId), createdAt: now, modifiedAt: now };
    });

    // Re-point copied descendants' parentId to the corresponding copied parent id
    // (descendantIds and descendantCopies share index order).
    descendantIds.forEach((originalId, i) => {
      const originalParentId = files.find((f) => f.id === originalId)!.parentId;
      if (originalParentId && idMap.has(originalParentId)) {
        descendantCopies[i].parentId = idMap.get(originalParentId)!;
      }
    });

    persist([...files, rootCopy, ...descendantCopies]);
    return { copied: 1 + descendantCopies.length, blocked: false };
  };

  // Writes new content under a fresh storageKey and snapshots whatever was current into
  // `versions` first — the old bytes stay in IndexedDB under their original key, so
  // history is real (not just metadata) and survives a reload via the same hydration path.
  const updateFileContent = async (id: string, blob: Blob): Promise<void> => {
    const storageKey = generateStorageKey();
    await putBlob(storageKey, blob);
    const blobUrl = URL.createObjectURL(blob);
    setFiles((prev) => {
      const updated = prev.map((f) => {
        if (f.id !== id) return f;
        const priorVersions = f.versions ?? [];
        const snapshot: FileVersion | null = f.storageKey
          ? { id: "version-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8), storageKey: f.storageKey, blobUrl: f.blobUrl, size: f.size, savedAt: f.modifiedAt }
          : null;
        return {
          ...f,
          blobUrl,
          storageKey,
          size: blob.size,
          modifiedAt: new Date().toISOString(),
          versions: snapshot ? [snapshot, ...priorVersions] : priorVersions,
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Promotes a past version to current. The content it replaces isn't lost — it becomes a
  // new history entry — so restoring is itself always reversible. Purely a re-pointing of
  // existing storageKeys/blobUrls, so it's synchronous (no IndexedDB write needed).
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
          modifiedAt: new Date().toISOString(),
          versions: [currentAsVersion, ...remaining],
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const setShareSettings = (id: string, settings: ShareSettings) => {
    setFiles((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, share: settings } : f));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearShareSettings = (id: string) => {
    setFiles((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, share: undefined } : f));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <FileSystemContext.Provider
      value={{
        files,
        isLoading,
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
