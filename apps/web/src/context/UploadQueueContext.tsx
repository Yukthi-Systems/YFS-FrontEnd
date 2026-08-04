import React, { createContext, useContext, useRef, useState } from "react";
import { useFileSystem } from "./FileSystemContext";
import { categorizeFile } from "../utils/fileType";
import { MockUploadClient } from "../services/uploadClient";
import type { UploadClient } from "../services/uploadClient";

export interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

export interface FileWithRelativePath {
  file: File;
  // e.g. "SubFolder/nested/file.txt" for a folder upload, or just "file.txt" for a flat one.
  relativePath: string;
}

interface UploadQueueContextType {
  tasks: UploadTask[];
  enqueueFiles: (items: FileWithRelativePath[], parentId: string | null) => void;
  dismissTask: (id: string) => void;
}

const UploadQueueContext = createContext<UploadQueueContextType | null>(null);

// Single instance = the one call site to swap for a real TusUploadClient later.
const uploadClient: UploadClient = new MockUploadClient();

export const UploadQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { files, createFolder, addFile } = useFileSystem();
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const taskCounter = useRef(0);

  const updateTask = (id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const dismissTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Resolves (creating as needed) the folder chain for one relative path, sharing a cache
  // across the whole batch so sibling files reuse the same new subfolder instead of each
  // recreating it — context.files won't reflect a just-created folder until the next
  // render, so this cache (not context.files) is the source of truth mid-batch.
  const resolveFolderId = (segments: string[], rootParentId: string | null, cache: Map<string, string>): string | null => {
    let parentId = rootParentId;
    for (const segment of segments) {
      const cacheKey = `${parentId}::${segment}`;
      let folderId = cache.get(cacheKey);
      if (!folderId) {
        const existing = files.find((f) => f.isFolder && !f.isDeleted && f.parentId === parentId && f.name === segment);
        const folder = existing ?? createFolder(segment, parentId);
        folderId = folder?.id;
        if (folderId) cache.set(cacheKey, folderId);
      }
      if (!folderId) break;
      parentId = folderId;
    }
    return parentId;
  };

  const enqueueFiles = (items: FileWithRelativePath[], parentId: string | null) => {
    const folderCache = new Map<string, string>();

    for (const { file, relativePath } of items) {
      const segments = relativePath.split("/").filter(Boolean);
      const folderSegments = segments.slice(0, -1);
      const targetParentId = folderSegments.length > 0 ? resolveFolderId(folderSegments, parentId, folderCache) : parentId;

      taskCounter.current += 1;
      const taskId = `upload-${taskCounter.current}`;
      setTasks((prev) => [...prev, { id: taskId, fileName: file.name, progress: 0, status: "uploading" }]);

      const { type, extension } = categorizeFile(file);

      uploadClient
        .upload(file, (pct) => updateTask(taskId, { progress: pct }))
        .then(({ storageKey, size }) => {
          addFile({ name: file.name, parentId: targetParentId, size, type, extension, storageKey, blob: file });
          updateTask(taskId, { status: "done", progress: 100 });
          // Auto-clear successful uploads (like toasts) so they don't linger in the tray
          // and collide with the same filename showing up in the file list. Errors stay
          // until dismissed so failures don't get missed.
          setTimeout(() => dismissTask(taskId), 4000);
        })
        .catch((err) => {
          updateTask(taskId, { status: "error", error: err instanceof Error ? err.message : "Upload failed" });
        });
    }
  };

  return <UploadQueueContext.Provider value={{ tasks, enqueueFiles, dismissTask }}>{children}</UploadQueueContext.Provider>;
};

export const useUploadQueue = () => {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) throw new Error("useUploadQueue must be used within an UploadQueueProvider");
  return ctx;
};
