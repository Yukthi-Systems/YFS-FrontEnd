import { useRef } from "react";
import { useAtom } from "jotai";
import type { FileOperationResult } from "@yfs/service";
import { useAuth } from "../context/AuthContext";
import { useFileSystem } from "../context/FileSystemContext";
import { categorizeFile, sanitizeName } from "../utils/fileType";
import { uploadClient } from "../services/uploadClient";
import { buildFileOperations, runPool, UPLOAD_CONCURRENCY, type PlannedUpload } from "../services/uploadPlan";
import { uploadTasksAtom, type UploadTask, type FileWithRelativePath } from "../atoms/uploadQueue";

export type { UploadTask, FileWithRelativePath } from "../atoms/uploadQueue";

// POST /files/operations wants a folder_id; the user's root isn't a folder row here,
// so send "" and let the API map it to the root. TODO: confirm with the real handler.
const ROOT_FOLDER_ID = "";
const toParentId = (folderId: string): string | null => (folderId === ROOT_FOLDER_ID ? null : folderId);

export const useUploadQueue = () => {
  const { token, user } = useAuth();
  const { files, ensureFolderPath, addFile, loadFolder, getSharedFolderId } = useFileSystem();
  const [tasks, setTasks] = useAtom(uploadTasksAtom);
  const taskCounter = useRef(0);

  // Async upload runs span renders — read live context off refs.
  const ctxRef = useRef({ token, versioningEnabled: !!user?.is_file_versioning_enabled, files });
  ctxRef.current = { token, versioningEnabled: !!user?.is_file_versioning_enabled, files };

  const updateTask = (id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const dismissTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Resolve the folder chain for one relative path to a real folder id, caching per
  // distinct path so siblings in a folder upload share the work.
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
    // 1. Resolve every file's target folder (creating folders as needed).
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

    // 2. Build the /files/operations request for the files that resolved.
    const live = planned
      .map((p, i) => (p ? { plan: p, taskId: taskIds[i] } : null))
      .filter((x): x is { plan: PlannedUpload; taskId: string } => x !== null);
    if (live.length === 0) return;

    const { token: tk, versioningEnabled, files: existingFiles } = ctxRef.current;
    const entries = buildFileOperations(
      live.map((x) => x.plan),
      existingFiles,
      versioningEnabled
    );

    // 3. Ask the API for an upload URL per file (chunked inside the client for big folders).
    let targets: FileOperationResult[];
    try {
      targets = await uploadClient.requestUpload(tk ?? "", entries);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not get an upload URL";
      live.forEach((x) => updateTask(x.taskId, { status: "error", error: message }));
      return;
    }

    // 4. Push bytes, capped concurrency.
    await runPool(live, UPLOAD_CONCURRENCY, async ({ plan, taskId }, k) => {
      const target = targets[k];
      if (!target) {
        updateTask(taskId, { status: "error", error: "No upload URL returned" });
        return;
      }
      updateTask(taskId, { status: "uploading" });
      try {
        await uploadClient.upload(plan.file, target, (pct) => updateTask(taskId, { progress: pct }));
        const { type, extension } = categorizeFile(plan.file);
        addFile({
          name: plan.fileName,
          parentId: toParentId(plan.targetFolderId),
          size: plan.file.size,
          type,
          extension,
          storageKey: target.file_location,
          blob: plan.file,
          fileId: target.file_id,
          version: target.file_version,
        });
        updateTask(taskId, { status: "done", progress: 100 });
        // Auto-clear successes like toasts; errors stay until dismissed.
        setTimeout(() => dismissTask(taskId), 4000);
      } catch (err) {
        updateTask(taskId, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    });

    // 5. Re-list every touched folder so server rows replace the optimistic ones.
    //    The Storage API confirms the committed version to YFS-Main-API through a
    //    server-side callback that can land a beat after the upload response, so
    //    re-list again shortly after to pick up the real row + its version.
    const touched = new Set(live.map((x) => x.plan.targetFolderId));
    const relist = () => touched.forEach((folderId) => loadFolder(toParentId(folderId), { force: true }));
    relist();
    setTimeout(relist, 2500);
  };

  const hasSubfolder = (it: FileWithRelativePath) => it.relativePath.split("/").filter(Boolean).length > 1;

  const enqueueFiles = (items: FileWithRelativePath[], parentId: string | null) => {
    if (items.length === 0) return;

    // Files can't live at the My Drive root — the backend requires a folder_id.
    // Folder uploads (relativePath carries a subfolder) are fine; they nest.
    let accepted = items;
    if (parentId === null) {
      const rejected = items.filter((it) => !hasSubfolder(it));
      accepted = items.filter(hasSubfolder);
      if (rejected.length > 0) {
        setTasks((prev) => [
          ...prev,
          ...rejected.map((it) => {
            taskCounter.current += 1;
            return {
              id: `upload-${taskCounter.current}`,
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

    // A task per file, up front, so the tray fills immediately.
    const taskIds = accepted.map(() => {
      taskCounter.current += 1;
      return `upload-${taskCounter.current}`;
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
      // Anything from this run still mid-flight is now stuck — surface it.
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

  return { tasks, enqueueFiles, dismissTask };
};
