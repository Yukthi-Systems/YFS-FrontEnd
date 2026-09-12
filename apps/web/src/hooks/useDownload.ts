import { useRef } from "react";
import { HttpError, type FileDownloadRequest } from "@yfs/service";
import { useAuth } from "./useAuth";
import { useFileSystem } from "./useFileSystem";
import { downloadClient } from "../services/downloadClient";
import type { FileItem } from "../types/file";

// POST /files/download wants a folder_id; the user's root isn't a folder row here,
// so send "" like the upload flow does (see useUploadQueue.ts).
const ROOT_FOLDER_ID = "";
const DEFAULT_MIME = "application/octet-stream";

// Fetches a file's real bytes for download/preview: server-backed files (own or
// internally shared) go through YFS-Main-API's download session, then a direct GET
// against the Storage API. Anything else falls back to the local blob cache (a file
// uploaded in this tab, or a seeded demo item) — there's no server content for those.
export function useDownload() {
  const { token, refreshAccessToken } = useAuth();
  const { getSharedFolderId } = useFileSystem();

  // A batch/zip download can span many requests over a noticeable stretch of time —
  // read the live token at call time (like useUploadQueue's ctxRef) instead of
  // closing over whatever was current when this render's fetchBlob was created.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const fetchBlob = async (item: FileItem): Promise<Blob | null> => {
    if (item.isFolder) return null;

    if (item.origin !== "server" && item.origin !== "shared") {
      if (!item.blobUrl) return null;
      const res = await fetch(item.blobUrl);
      return res.blob();
    }
    if (!item.fileId) return null;

    const request: FileDownloadRequest = {
      folder_id: item.parentId ?? ROOT_FOLDER_ID,
      file_id: item.fileId,
      shared_folder_id: getSharedFolderId(item.parentId),
      file_name: item.name,
      file_info: item.resourceInfo ?? {},
      file_type: DEFAULT_MIME,
      file_version: item.version ?? 1,
      expected_file_size: item.size,
    };

    let session;
    try {
      session = await downloadClient.requestSession(tokenRef.current ?? "", request);
    } catch (err) {
      if (!(err instanceof HttpError) || (err.status !== 401 && err.status !== 400)) throw err;
      const fresh = await refreshAccessToken();
      if (!fresh) throw err;
      session = await downloadClient.requestSession(fresh, request);
    }

    return downloadClient.fetchBytes(session);
  };

  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadFile = async (item: FileItem): Promise<boolean> => {
    const blob = await fetchBlob(item);
    if (!blob) return false;
    saveBlob(blob, item.name);
    return true;
  };

  return { fetchBlob, downloadFile };
}
