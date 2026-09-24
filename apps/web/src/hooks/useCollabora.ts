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

import { useRef } from "react";
import { getFileBasicInfo, type FileWopiRequest } from "@yfs/service";
import { useAuth } from "./useAuth";
import { useFileSystem } from "./useFileSystem";
import { collaboraClient, resolveCollaboraAction, buildCollaboraActionUrl } from "../services/collaboraClient";
import { withAuthRetry } from "../utils/authRetry";
import type { FileItem } from "../types/file";

// The user's root isn't a folder row; the API takes "".
const ROOT_FOLDER_ID = "";
const DEFAULT_MIME = "application/octet-stream";

export interface CollaboraEditorSession {
  actionUrl: string; // loader URL the access_token is POSTed to
  accessToken: string;
  accessTokenTtl: number; // epoch ms
}

// Resolves the Collabora action and mints a WOPI session in parallel.
export function useCollabora() {
  const { token, refreshAccessToken } = useAuth();
  const { getSharedFolderId } = useFileSystem();

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const buildRequest = (item: FileItem, version: number): FileWopiRequest => ({
    folder_id: item.parentId ?? ROOT_FOLDER_ID,
    file_id: item.fileId!,
    shared_folder_id: getSharedFolderId(item.parentId),
    file_name: item.name,
    file_info: item.resourceInfo ?? {},
    file_type: DEFAULT_MIME,
    file_version: version,
    expected_file_size: item.size,
  });

  // Collabora saves create server-side versions, so fetch the latest before opening.
  const resolveLatestVersion = async (item: FileItem): Promise<number> => {
    const local = item.version ?? 1;
    try {
      const info = await getFileBasicInfo(tokenRef.current ?? "", buildRequest(item, 1));
      return info.available_versions.length ? Math.max(...info.available_versions) : local;
    } catch {
      return local;
    }
  };

  const requestWopi = (request: FileWopiRequest, toWrite: boolean) =>
    withAuthRetry(tokenRef.current, refreshAccessToken, (tk) => collaboraClient.requestSession(tk, request, toWrite));

  const getEditorSession = async (item: FileItem, wantEdit: boolean): Promise<CollaboraEditorSession> => {
    if (!item.extension) throw new Error("This file has no extension for Collabora to match.");
    if (!item.fileId || (item.origin !== "server" && item.origin !== "shared")) {
      throw new Error("This file has no server copy to open in Collabora.");
    }

    const [action, session] = await Promise.all([
      resolveCollaboraAction(item.extension, wantEdit),
      resolveLatestVersion(item).then((version) => requestWopi(buildRequest(item, version), wantEdit)),
    ]);
    if (!action) throw new Error(`Collabora doesn't support .${item.extension} files.`);

    return {
      actionUrl: buildCollaboraActionUrl(action, session.wopi_src),
      accessToken: session.token,
      accessTokenTtl: session.access_token_ttl,
    };
  };

  return { getEditorSession };
}
