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
import { useRef } from "react";
import { getFileBasicInfo, type DownloadSession, type FileDownloadRequest } from "@yfs/service";
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
