import { useRef } from "react";
import { getFileBasicInfo, type FileWopiRequest } from "@yfs/service";
import { useAuth } from "./useAuth";
import { useFileSystem } from "./useFileSystem";
import { collaboraClient, resolveCollaboraAction, buildCollaboraActionUrl } from "../services/collaboraClient";
import { withAuthRetry } from "../utils/authRetry";
import type { FileItem } from "../types/file";

// POST /files/wopi/session/create wants a folder_id; the user's root isn't a folder row here, so
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

  // item.version is only trustworthy if this tab last touched the file (Collabora saves
  // create new versions server-side) — ask the server for the real latest version so the
  // editor never opens stale content. Falls back to the local version if the lookup fails.
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
