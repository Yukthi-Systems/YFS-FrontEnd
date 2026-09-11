import { useRef } from "react";
import { useAtom } from "jotai";
import { HttpError, type FileUploadRequest, type UploadSession } from "@yfs/service";
import { useAuth } from "./useAuth";
import { useFileSystem } from "./useFileSystem";
import { categorizeFile, sanitizeName } from "../utils/fileType";
import { uploadClient } from "../services/uploadClient";
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

// POST /files/upload wants a folder_id; the user's root isn't a folder row here,
// so send "" and let the API map it to the root. TODO: confirm with the real handler.
const ROOT_FOLDER_ID = "";
const toParentId = (folderId: string): string | null => (folderId === ROOT_FOLDER_ID ? null : folderId);

export const useUploadQueue = () => {
  const { token, user, refreshAccessToken } = useAuth();
  const { files, ensureFolderPath, addFile, loadFolder, getSharedFolderId } = useFileSystem();
  const [tasks, setTasks] = useAtom(uploadTasksAtom);
  const taskCounter = useRef(0);

  // Async upload runs span renders — read live context off refs.
  const ctxRef = useRef({ token, versioningEnabled: !!user?.is_file_versioning_enabled, files, refreshAccessToken });
  ctxRef.current = { token, versioningEnabled: !!user?.is_file_versioning_enabled, files, refreshAccessToken };

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

    const live = planned
      .map((p, i) => (p ? { plan: p, taskId: taskIds[i] } : null))
      .filter((x): x is { plan: PlannedUpload; taskId: string } => x !== null);
    if (live.length === 0) return;

    // 2. Request an upload session and push bytes for each file — one
    //    POST /files/upload call per file (it isn't a batch endpoint), capped
    //    concurrency.
    await runPool(live, UPLOAD_CONCURRENCY, async ({ plan, taskId }) => {
      const { token: tk, versioningEnabled, files: existingFiles, refreshAccessToken: refresh } = ctxRef.current;

      const resolved = resolveUploadStep(plan, existingFiles, versioningEnabled);
      if ("blocked" in resolved) {
        updateTask(taskId, { status: "error", error: uploadBlockMessage(resolved.blocked) });
        return;
      }
      const { fileId, fileVersion } = resolved.step;

      updateTask(taskId, { status: "uploading" });
      try {
        const request: FileUploadRequest = {
          folder_id: plan.targetFolderId,
          file_id: fileId,
          shared_folder_id: plan.sharedFolderId,
          file_name: plan.fileName,
          file_info: {},
          file_type: fileTypeOf(plan.file),
          file_version: fileVersion,
          expected_file_size: plan.file.size,
        };

        let session: UploadSession;
        try {
          session = await uploadClient.requestUpload(tk ?? "", request);
        } catch (err) {
          if (!(err instanceof HttpError) || (err.status !== 401 && err.status !== 400)) throw err;
          const fresh = await refresh();
          if (!fresh) throw err;
          session = await uploadClient.requestUpload(fresh, request);
        }

        const { storageKey } = await uploadClient.upload(plan.file, session, (pct) => updateTask(taskId, { progress: pct }));
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
        // Auto-clear successes like toasts; errors stay until dismissed.
        setTimeout(() => dismissTask(taskId), 4000);
      } catch (err) {
        updateTask(taskId, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    });

    // 3. Re-list every touched folder so server rows replace the optimistic ones.
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
