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

import { useEffect, useRef } from "react";
import { useAtom } from "jotai";
import { type FileUploadRequest, type UploadSession } from "@yfs/service";
import { useAuth } from "./useAuth";
import { useFileSystem } from "./useFileSystem";
import { categorizeFile, sanitizeName } from "../utils/fileType";
import { uploadClient, type UploadHandle } from "../services/uploadClient";
import { withAuthRetry } from "../utils/authRetry";
import { showToast } from "../atoms/toast";
import {
  resolveUploadStep,
  uploadBlockMessage,
  fileTypeOf,
  runPool,
  UPLOAD_CONCURRENCY,
  type PlannedUpload,
} from "../services/uploadPlan";
import { uploadTasksAtom, type UploadTask, type FileWithRelativePath } from "../atoms/uploadQueue";

export type { UploadTask, FileWithRelativePath } from "../atoms/uploadQueue";

// The user's root isn't a folder row; the API takes "".
const ROOT_FOLDER_ID = "";
const toParentId = (folderId: string): string | null => (folderId === ROOT_FOLDER_ID ? null : folderId);

// Module-level so App (starts uploads) and UploadTray (pauses/cancels) share the same handles.
const activeHandles = new Map<string, UploadHandle>();
// Cancelled before a handle existed; workers check this before starting.
const cancelledPending = new Set<string>();
let taskCounter = 0;

export const useUploadQueue = () => {
  const { token, user, refreshAccessToken } = useAuth();
  const { files, ensureFolderPath, addFile, loadFolder, getSharedFolderId, buildCreationInfo } = useFileSystem();
  const [tasks, setTasks] = useAtom(uploadTasksAtom);

  // Uploads span renders, so read live context from a ref.
  const ctxRef = useRef({ token, versioningEnabled: !!user?.is_file_versioning_enabled, files, refreshAccessToken });
  ctxRef.current = { token, versioningEnabled: !!user?.is_file_versioning_enabled, files, refreshAccessToken };

  useEffect(() => {
    const handleOffline = () => {
      activeHandles.forEach((handle, id) => {
        handle.pause();
        updateTask(id, {
          status: "reconnecting",
          error: "Connection lost — waiting to reconnect…",
        });
      });
    };

    const handleOnline = () => {
      setTasks((prev) => {
        const reconnecting = prev.filter((t) => t.status === "reconnecting");
        reconnecting.forEach((t) => {
          activeHandles.get(t.id)?.resume();
        });
        return prev.map((t) =>
          t.status === "reconnecting"
            ? { ...t, status: "uploading", error: undefined }
            : t
        );
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const updateTask = (id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        if (patch.status === "uploading" && patch.error === undefined) {
          next.error = undefined;
        }
        return next;
      })
    );
  };

  const pauseTask = (id: string) => activeHandles.get(id)?.pause();
  const resumeTask = (id: string) => activeHandles.get(id)?.resume();

  const cancelTask = (id: string) => {
    const handle = activeHandles.get(id);
    if (handle) {
      handle.cancel();
      return;
    }
    cancelledPending.add(id);
    updateTask(id, { status: "error", error: "Cancelled" });
  };

  const dismissTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task && (task.status === "uploading" || task.status === "paused" || task.status === "pending")) {
      cancelTask(id);
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Cached per path so sibling files share the work.
  const resolvePathFolderId = async (
    folderSegments: string[],
    rootParentId: string | null,
    cache: Map<string, string | null>
  ): Promise<string | null> => {
    if (folderSegments.length === 0) return rootParentId ?? ROOT_FOLDER_ID;
    const cacheKey = folderSegments.join("/");
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;
    const resolved = await ensureFolderPath(folderSegments, rootParentId);
    cache.set(cacheKey, resolved);
    return resolved;
  };

  const runUpload = async (items: FileWithRelativePath[], parentId: string | null, taskIds: string[]) => {
    // 1. Resolve every file's target folder, creating folders as needed.
    const folderCache = new Map<string, string | null>();
    const planned: (PlannedUpload | null)[] = [];
    for (let i = 0; i < items.length; i++) {
      const { file, relativePath } = items[i];
      const segments = relativePath.split("/").filter(Boolean);
      const folderId = await resolvePathFolderId(segments.slice(0, -1), parentId, folderCache);
      if (folderId === null) {
        updateTask(taskIds[i], { status: "error", error: "Could not create destination folder" });
        planned.push(null);
        continue;
      }
      planned.push({
        file,
        fileName: sanitizeName(file.name) || file.name,
        targetFolderId: folderId,
        sharedFolderId: getSharedFolderId(folderId),
      });
    }

    const live = planned
      .map((p, i) => (p ? { plan: p, taskId: taskIds[i] } : null))
      .filter((x): x is { plan: PlannedUpload; taskId: string } => x !== null);
    if (live.length === 0) return;

    // 2. One upload session per file, with capped concurrency.
    await runPool(live, UPLOAD_CONCURRENCY, async ({ plan, taskId }) => {
      if (cancelledPending.delete(taskId)) return;

      const { token: tk, versioningEnabled, files: existingFiles, refreshAccessToken: refresh } = ctxRef.current;

      updateTask(taskId, { status: "uploading" });
      try {
        const resolved = await resolveUploadStep(plan, existingFiles, versioningEnabled, tk ?? "");
        if ("blocked" in resolved) {
          updateTask(taskId, { status: "error", error: uploadBlockMessage(resolved.blocked) });
          return;
        }
        const { fileId, fileVersion } = resolved.step;

        const request: FileUploadRequest = {
          folder_id: plan.targetFolderId,
          file_id: fileId,
          shared_folder_id: plan.sharedFolderId,
          file_name: plan.fileName,
          file_info: buildCreationInfo(),
          file_type: fileTypeOf(plan.file),
          file_version: fileVersion,
          expected_file_size: plan.file.size,
        };

        const session: UploadSession = await withAuthRetry(tk, refresh, (t) => uploadClient.requestUpload(t, request));

        if (cancelledPending.delete(taskId)) return;

        const handle = uploadClient.startUpload(
          plan.file,
          session,
          (pct) => updateTask(taskId, { progress: pct }),
          (status) => updateTask(taskId, { status })
        );
        activeHandles.set(taskId, handle);
        try {
          await handle.promise;
        } finally {
          activeHandles.delete(taskId);
        }

        const storageKey = await uploadClient.cacheLocally(plan.file);
        const { type, extension } = categorizeFile(plan.file);
        addFile({
          name: plan.fileName,
          parentId: toParentId(plan.targetFolderId),
          size: plan.file.size,
          type,
          extension,
          storageKey,
          blob: plan.file,
          fileId: session.file_id,
          version: session.file_version,
        });
        updateTask(taskId, { status: "done", progress: 100 });
        setTimeout(() => dismissTask(taskId), 4000);
      } catch (err) {
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        if (isOffline && !isAbort) {
          updateTask(taskId, {
            status: "reconnecting",
            error: "Connection lost — waiting to reconnect…",
          });
          return;
        }
        updateTask(taskId, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    });

    // 3. Re-list touched folders, and again shortly after for the server's version callback.
    const touched = new Set(live.map((x) => x.plan.targetFolderId));
    const relist = () => touched.forEach((folderId) => loadFolder(toParentId(folderId), { force: true }));
    relist();
    setTimeout(relist, 2500);
  };

  const hasSubfolder = (it: FileWithRelativePath) => it.relativePath.split("/").filter(Boolean).length > 1;

  const enqueueFiles = (items: FileWithRelativePath[], parentId: string | null) => {
    if (items.length === 0) return;

    // Files can't live at the My Drive root; the backend requires a folder_id.
    let accepted = items;
    if (parentId === null) {
      const rejected = items.filter((it) => !hasSubfolder(it));
      accepted = items.filter(hasSubfolder);
      if (rejected.length > 0) {
        showToast("Open or create a folder to upload files — My Drive can't hold files directly", "error");
        setTasks((prev) => [
          ...prev,
          ...rejected.map((it) => {
            taskCounter += 1;
            return {
              id: `upload-${taskCounter}`,
              fileName: it.file.name,
              progress: 0,
              status: "error" as const,
              error: "Open or create a folder — My Drive can't hold files directly",
            };
          }),
        ]);
      }
    }
    if (accepted.length === 0) return;

    const taskIds = accepted.map(() => {
      taskCounter += 1;
      return `upload-${taskCounter}`;
    });
    setTasks((prev) => [
      ...prev,
      ...accepted.map((it, i) => ({
        id: taskIds[i],
        fileName: it.file.name,
        progress: 0,
        status: "pending" as const,
      })),
    ]);

    runUpload(accepted, parentId, taskIds).catch((err) => {
      console.error("Upload run failed", err);
      const stuck = new Set(taskIds);
      setTasks((prev) =>
        prev.map((t) =>
          stuck.has(t.id) && (t.status === "pending" || t.status === "uploading")
            ? { ...t, status: "error", error: "Upload failed" }
            : t
        )
      );
    });
  };

  return { tasks, enqueueFiles, dismissTask, pauseTask, resumeTask, cancelTask };
};
