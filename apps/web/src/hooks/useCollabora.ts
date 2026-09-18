import { useRef } from "react";
import { HttpError, type FileWopiRequest } from "@yfs/service";
import { useAuth } from "./useAuth";
import { useFileSystem } from "./useFileSystem";
import { collaboraClient, resolveCollaboraAction, buildCollaboraActionUrl } from "../services/collaboraClient";
import type { FileItem } from "../types/file";

// POST /sessions/wopi wants a folder_id; the user's root isn't a folder row here, so
// send "" like the upload/download flows do.
const ROOT_FOLDER_ID = "";
const DEFAULT_MIME = "application/octet-stream";

export interface CollaboraEditorSession {
  actionUrl: string; // Collabora loader URL (cool.html?WOPISrc=...) to POST access_token against
  accessToken: string;
  accessTokenTtl: number; // epoch ms, per the WOPI iframe integration spec
}

// Opens a server-backed file in Collabora Online: resolves the right Collabora
// action (edit/view) for its extension via discovery.xml, in parallel with minting
// a WOPI session from YFS-Main-API, then builds what the iframe/form needs.
export function useCollabora() {
  const { token, refreshAccessToken } = useAuth();
  const { getSharedFolderId } = useFileSystem();

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const buildRequest = (item: FileItem, wantEdit: boolean): FileWopiRequest => ({
    folder_id: item.parentId ?? ROOT_FOLDER_ID,
    file_id: item.fileId!,
    shared_folder_id: getSharedFolderId(item.parentId),
    file_name: item.name,
    file_info: item.resourceInfo ?? {},
    file_type: DEFAULT_MIME,
    file_version: item.version ?? 1,
    expected_file_size: item.size,
    can_edit: wantEdit,
  });

  const requestWopi = async (request: FileWopiRequest) => {
    try {
      return await collaboraClient.requestSession(tokenRef.current ?? "", request);
    } catch (err) {
      if (!(err instanceof HttpError) || (err.status !== 401 && err.status !== 400)) throw err;
      const fresh = await refreshAccessToken();
      if (!fresh) throw err;
      return collaboraClient.requestSession(fresh, request);
    }
  };

  const getEditorSession = async (item: FileItem, wantEdit: boolean): Promise<CollaboraEditorSession> => {
    if (!item.extension) throw new Error("This file has no extension for Collabora to match.");
    if (!item.fileId || (item.origin !== "server" && item.origin !== "shared")) {
      throw new Error("This file has no server copy to open in Collabora.");
    }

    const [action, session] = await Promise.all([
      resolveCollaboraAction(item.extension, wantEdit),
      requestWopi(buildRequest(item, wantEdit)),
    ]);
    if (!action) throw new Error(`Collabora doesn't support .${item.extension} files.`);

    return {
      actionUrl: buildCollaboraActionUrl(action, session.wopi_src),
      accessToken: session.token,
      accessTokenTtl: new Date(session.expires_at).getTime(),
    };
  };

  return { getEditorSession };
}
