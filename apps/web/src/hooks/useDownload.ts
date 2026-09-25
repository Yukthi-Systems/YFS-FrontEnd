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

import { useQuery } from "@tanstack/react-query";
import { getDefaultStore, useAtomValue } from "jotai";
import { useRef } from "react";
import {
  getFileBasicInfo,
  requestFolderArchive,
  type ArchiveCompletedEvent,
  type ArchiveExportType,
  type ArchiveProgressEvent,
  type DownloadSession,
  type FileDownloadRequest,
} from "@yfs/service";
import { archiveJobsAtom, type ArchiveJob } from "../atoms/archiveJobs";
import { isServerId } from "../services/fileSystemStore";
import { showToast } from "../atoms/toast";
import { shortName } from "../utils/format";
import { useAuth } from "./useAuth";
import { useFileSystem } from "./useFileSystem";
import { downloadClient } from "../services/downloadClient";
import { withAuthRetry } from "../utils/authRetry";
import type { FileItem } from "../types/file";

// The user's root isn't a folder row; the API takes "".
const ROOT_FOLDER_ID = "";
const DEFAULT_MIME = "application/octet-stream";

// Served inline by YFS-Files-Api, so these need a blob download; other types download via plain navigation.
const INLINE_FORCED_TYPES = new Set<FileItem["type"]>(["image", "video", "audio", "pdf"]);

// Server files go through a download session; local-only files fall back to the blob cache.
export function useDownload() {
  const { token, refreshAccessToken } = useAuth();
  const { getSharedFolderId } = useFileSystem();

  // Read the live token; batch downloads outlast a render.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const buildRequest = (item: FileItem, versionOverride?: number): FileDownloadRequest => ({
    folder_id: item.parentId ?? ROOT_FOLDER_ID,
    file_id: item.fileId!,
    shared_folder_id: getSharedFolderId(item.parentId),
    file_name: item.name,
    file_info: item.resourceInfo ?? {},
    file_type: DEFAULT_MIME,
    file_version: versionOverride ?? item.version ?? 1,
    expected_file_size: item.size,
  });

  // Ask the server for the latest version; fall back to local state if that fails.
  const resolveLatestVersion = async (item: FileItem): Promise<number> => {
    if (!item.fileId || !item.parentId) return item.version ?? 1;
    try {
      const info = await getFileBasicInfo(tokenRef.current ?? "", buildRequest(item, 1));
      return info.available_versions.length ? Math.max(...info.available_versions) : (item.version ?? 1);
    } catch {
      return item.version ?? 1;
    }
  };

  const requestSession = (request: FileDownloadRequest): Promise<DownloadSession> =>
    withAuthRetry(tokenRef.current, refreshAccessToken, (tk) => downloadClient.requestSession(tk, request));

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
      const latestVersion = await resolveLatestVersion(item);
      const session = await requestSession(buildRequest(item, latestVersion));
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

  // Always fetches bytes into a blob so the saved name can include the version.
  const downloadFileVersion = async (item: FileItem, version: number): Promise<boolean> => {
    if (item.isFolder || !item.fileId || (item.origin !== "server" && item.origin !== "shared")) return false;
    const session = await requestSession(buildRequest(item, version));
    const blob = await downloadClient.fetchBytes(session);
    saveBlob(blob, `v${version}-${item.name}`);
    return true;
  };

  return { fetchBlob, downloadFile, downloadFileVersion, getStreamUrl };
}

// Media streams straight from the session URL (inline, ?token=), no CORS needed.
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

export const ARCHIVE_FORMATS: { value: ArchiveExportType; label: string }[] = [
  { value: "zip", label: ".zip" },
  { value: "tar", label: ".tar" },
];

// Server folders are archived server-side (zip or tar); local-only ones can only be zipped in the browser.
export const canArchiveOnServer = (item: FileItem) =>
  item.isFolder && (item.origin === "server" || item.origin === "shared") && isServerId(item.id);

const store = getDefaultStore();
// Open SSE streams per archive job; module-level so any caller can close them.
const archiveStreams = new Map<string, EventSource>();

const patchJob = (id: string, patch: Partial<ArchiveJob>) =>
  store.set(archiveJobsAtom, (prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

const parseEvent = <T,>(e: Event): T | null => {
  const data = (e as MessageEvent).data;
  if (typeof data !== "string" || !data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
};

const closeStream = (id: string) => {
  archiveStreams.get(id)?.close();
  archiveStreams.delete(id);
};

const withToken = (url: string, token: string) => {
  const u = new URL(url);
  u.searchParams.set("token", token);
  return u.toString();
};

// Hidden iframe: saves an attachment without navigating the app away if the response isn't one.
export const saveFromUrl = (url: string) => {
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  frame.src = url;
  document.body.appendChild(frame);
  setTimeout(() => frame.remove(), 60_000);
};

const failJob = (id: string, name: string, message: string) => {
  closeStream(id);
  patchJob(id, { status: "failed", error: message });
  showToast(`Couldn't prepare "${shortName(name)}": ${message}`, "error");
};

const watchArchive = (id: string, name: string, eventsUrl: string) => {
  const es = new EventSource(eventsUrl);
  archiveStreams.set(id, es);

  const onProgress = (e: Event) => {
    const d = parseEvent<ArchiveProgressEvent>(e);
    patchJob(id, {
      status: "processing",
      ...(d && {
        processedFiles: d.processed_files,
        totalFiles: d.total_files,
        processedBytes: d.processed_bytes,
        totalBytes: d.total_bytes,
      }),
    });
  };
  const onCompleted = (e: Event) => {
    const d = parseEvent<ArchiveCompletedEvent>(e);
    closeStream(id);
    if (!d?.download_url || !d.download_token) {
      failJob(id, name, "The archive finished but no download link was returned");
      return;
    }
    const downloadUrl = withToken(d.download_url, d.download_token);
    patchJob(id, { status: "ready", downloadUrl, expiresAt: Date.now() + d.expires_in * 1000 });
    saveFromUrl(downloadUrl);
  };
  const onFailed = (fallback: string) => (e: Event) => {
    const d = parseEvent<{ error?: string; message?: string }>(e);
    failJob(id, name, d?.error || d?.message || fallback);
  };

  es.addEventListener("queued", () => patchJob(id, { status: "queued" }));
  es.addEventListener("processing", onProgress);
  es.addEventListener("progress", onProgress);
  es.addEventListener("completed", onCompleted);
  es.addEventListener("failed", onFailed("The archive could not be created"));
  es.addEventListener("expired", onFailed("The archive expired before it was downloaded"));
  // Unnamed messages: dispatch on the payload's status, if any.
  es.onmessage = (e) => {
    const status = parseEvent<{ status?: string }>(e)?.status;
    if (status === "completed") onCompleted(e);
    else if (status === "failed" || status === "expired") onFailed("The archive could not be created")(e);
    else if (status === "processing") onProgress(e);
  };
  es.onerror = (e) => {
    // A server-sent "error" event carries data; a dropped connection doesn't and EventSource retries it.
    if ((e as MessageEvent).data) onFailed("The archive could not be created")(e);
    else if (es.readyState === EventSource.CLOSED) failJob(id, name, "Lost connection to the archive service");
  };
};

// Folder downloads built server-side (zip/tar) with live progress; see DownloadTray.
export function useFolderArchive() {
  const { token, refreshAccessToken } = useAuth();
  const { getSharedFolderId } = useFileSystem();
  const jobs = useAtomValue(archiveJobsAtom);

  const startFolderArchive = async (folder: FileItem, exportType: ArchiveExportType = "zip") => {
    const id = `archive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const name = `${folder.name}.${exportType}`;
    store.set(archiveJobsAtom, (prev) => [
      ...prev,
      { id, name, status: "starting", processedFiles: 0, totalFiles: 0, processedBytes: 0, totalBytes: 0 },
    ]);
    try {
      const job = await withAuthRetry(token, refreshAccessToken, (tk) =>
        requestFolderArchive(tk, {
          folderId: folder.id,
          sharedFolderId: getSharedFolderId(folder.id),
          archiveName: name,
          exportType,
          folderInfo: folder.resourceInfo ?? {},
        })
      );
      patchJob(id, { status: "queued" });
      watchArchive(id, name, job.events_url);
    } catch (err) {
      failJob(id, name, err instanceof Error ? err.message : "Request failed");
    }
  };

  const dismissArchive = (id: string) => {
    closeStream(id);
    store.set(archiveJobsAtom, (prev) => prev.filter((j) => j.id !== id));
  };

  return { jobs, startFolderArchive, dismissArchive };
}

