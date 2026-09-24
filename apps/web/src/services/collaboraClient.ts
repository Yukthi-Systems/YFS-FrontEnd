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

import axios from "axios";
import { readEnv, requestWopiSession, type FileWopiRequest, type WopiSession } from "@yfs/service";
import { COLLABORA_BASE_URL } from "./collaboraConstants";

// Resolves the Collabora action for a file extension via discovery.xml.
export { COLLABORA_BASE_URL } from "./collaboraConstants";
const DISCOVERY_URL = `${COLLABORA_BASE_URL}/hosting/discovery`;

// discovery.xml is CORS-blocked from the app's origin, so fall back to the loader URL (its hash changes on Collabora upgrades).
const FALLBACK_LOADER_URL = readEnv("VITE_COLLABORA_LOADER_URL") || `${COLLABORA_BASE_URL}/browser/cc5614c67e/cool.html?`;

export interface CollaboraAction {
  urlsrc: string;
  name: string;
}

// discovery.xml only changes on a Collabora upgrade.
let discoveryPromise: Promise<Document> | null = null;
// Sticky so a blocked discovery fetch isn't retried for every file.
let discoveryFailed = false;

const fetchDiscovery = (): Promise<Document> => {
  if (!discoveryPromise) {
    discoveryPromise = axios
      .get<string>(DISCOVERY_URL, { withCredentials: false, responseType: "text" })
      .then((res) => {
        const doc = new DOMParser().parseFromString(res.data, "text/xml");
        if (doc.getElementsByTagName("parsererror").length > 0) {
          throw new Error("Collabora discovery response was not valid XML");
        }
        return doc;
      })
      .catch((err) => {
        discoveryPromise = null;
        throw err;
      });
  }
  return discoveryPromise;
};

// Prefers an editor when `wantEdit`, else a viewer ("view_comment" for PDFs).
export const resolveCollaboraAction = async (
  extension: string,
  wantEdit: boolean
): Promise<CollaboraAction | null> => {
  if (discoveryFailed) return { urlsrc: FALLBACK_LOADER_URL, name: wantEdit ? "edit" : "view" };

  let doc: Document;
  try {
    doc = await fetchDiscovery();
  } catch (err) {
    // Discovery unreachable (CORS/network): use the fallback loader.
    discoveryFailed = true;
    console.warn(
      "[Collabora] discovery.xml fetch failed (most likely CORS-blocked from this origin) — using the fallback loader URL for the rest of this session instead of retrying per file.",
      err
    );
    return { urlsrc: FALLBACK_LOADER_URL, name: wantEdit ? "edit" : "view" };
  }
  const ext = extension.toLowerCase();
  const actions = Array.from(doc.getElementsByTagName("action")).filter(
    (el) => el.getAttribute("ext")?.toLowerCase() === ext
  );
  if (actions.length === 0) return null;

  const byName = (name: string) => actions.find((el) => el.getAttribute("name") === name);
  const picked = (wantEdit ? byName("edit") : undefined) ?? byName("view") ?? byName("view_comment") ?? actions[0];
  const urlsrc = picked.getAttribute("urlsrc");
  if (!urlsrc) return null;
  return { urlsrc, name: picked.getAttribute("name") ?? "view" };
};

// closebutton=1 shows Collabora's close icon; the viewers intercept its UI_Close to save first.
export const buildCollaboraActionUrl = (action: CollaboraAction, wopiSrc: string): string => {
  const sep = action.urlsrc.endsWith("?") || action.urlsrc.endsWith("&")
    ? ""
    : action.urlsrc.includes("?") ? "&" : "?";
  return `${action.urlsrc}${sep}WOPISrc=${encodeURIComponent(wopiSrc)}&closebutton=1`;
};

export const collaboraClient = {
  requestSession(token: string, req: FileWopiRequest, toWrite: boolean): Promise<WopiSession> {
    return requestWopiSession(token, req, toWrite);
  },
};
