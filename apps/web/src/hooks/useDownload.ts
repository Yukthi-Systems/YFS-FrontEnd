import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { HttpError, type DownloadSession, type FileDownloadRequest } from "@yfs/service";
import { useAuth } from "./useAuth";
import { useFileSystem } from "./useFileSystem";
import { downloadClient } from "../services/downloadClient";
import type { FileItem } from "../types/file";

// POST /files/download wants a folder_id; the user's root isn't a folder row here,
// so send "" like the upload flow does (see useUploadQueue.ts).
const ROOT_FOLDER_ID = "";
const DEFAULT_MIME = "application/octet-stream";

// YFS-Files-Api's /download/{fileID} (media/service.go BuildHeaders) sends
// Content-Disposition: attachment for everything except these — images, video,
// audio, and PDF always come back inline, regardless of intent. For "attachment"
// types, a plain navigation to session.url triggers a real native browser download
// (the browser recognizes it isn't a page to render and doesn't even leave the
// current one) with zero fetch/CORS involved — the `?token=` query param on the URL
// is exactly what makes that possible without an Authorization header. Inline types
// need the bytes read in JS instead (to force a save via a local blob: URL), which
// does require the Storage API to allow CORS on that route.
const INLINE_FORCED_TYPES = new Set<FileItem["type"]>(["image", "video", "audio", "pdf"]);

// Fetches a file's real bytes for zip/batch download or preview: server-backed
// files (own or internally shared) go through YFS-Main-API's download session, then
// a direct GET against the Storage API. Anything else falls back to the local blob
// cache (a file uploaded in this tab, or a seeded demo item) — there's no server
// content for those.
export function useDownload() {
  const { token, refreshAccessToken } = useAuth();
  const { getSharedFolderId } = useFileSystem();

  // A batch/zip download can span many requests over a noticeable stretch of time —
  // read the live token at call time (like useUploadQueue's ctxRef) instead of
  // closing over whatever was current when this render's fetchBlob was created.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const buildRequest = (item: FileItem): FileDownloadRequest => ({
    folder_id: item.parentId ?? ROOT_FOLDER_ID,
    file_id: item.fileId!,
    shared_folder_id: getSharedFolderId(item.parentId),
    file_name: item.name,
    file_info: item.resourceInfo ?? {},
    file_type: DEFAULT_MIME,
    file_version: item.version ?? 1,
    expected_file_size: item.size,
  });

  const requestSession = async (request: FileDownloadRequest): Promise<DownloadSession> => {
    try {
      return await downloadClient.requestSession(tokenRef.current ?? "", request);
    } catch (err) {
      if (!(err instanceof HttpError) || (err.status !== 401 && err.status !== 400)) throw err;
      const fresh = await refreshAccessToken();
      if (!fresh) throw err;
      return downloadClient.requestSession(fresh, request);
    }
  };

  const getStreamUrl = async (item: FileItem): Promise<string | null> => {
    if (item.blobUrl) return item.blobUrl;
    if (item.isFolder || !item.fileId) return null;
    if (item.origin !== "server" && item.origin !== "shared") return null;

    const session = await requestSession(buildRequest(item));
    return session.url;
  };

  const fetchBlob = async (item: FileItem): Promise<Blob | null> => {
    if (item.isFolder) return null;

    if (item.origin !== "server" && item.origin !== "shared") {
      if (!item.blobUrl) return null;
      const res = await fetch(item.blobUrl);
      return res.blob();
    }
    if (!item.fileId) return null;

    const session = await requestSession(buildRequest(item));
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
    if (
      !item.isFolder &&
      item.fileId &&
      (item.origin === "server" || item.origin === "shared")
    ) {
      const session = await requestSession(buildRequest(item));
      if (INLINE_FORCED_TYPES.has(item.type)) {
        window.open(session.url, "_blank");
      } else {
        window.location.href = session.url;
      }
      return true;
    }

    const blob = await fetchBlob(item);
    if (!blob) return false;
    saveBlob(blob, item.name);
    return true;
  };

  return { fetchBlob, downloadFile, getStreamUrl };
}

// Media streaming hook (video, audio, image): fetches the direct session URL which
// carries ?token= and is served inline, enabling native streaming/seeking without CORS.
export function useStreamUrl(item: FileItem | null) {
  const { getStreamUrl } = useDownload();

  return useQuery({
    queryKey: ["streamUrl", item?.id, item?.fileId, item?.version, item?.blobUrl],
    queryFn: async () => {
      if (!item) return null;
      return getStreamUrl(item);
    },
    enabled:
      !!item &&
      !item.isFolder &&
      (!!item.blobUrl || (!!item.fileId && (item.origin === "server" || item.origin === "shared"))),
    staleTime: 5 * 60 * 1000,
  });
}
