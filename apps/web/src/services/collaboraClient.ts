import { requestWopiSession, type FileWopiRequest, type WopiSession } from "@yfs/service";

// Collabora Online (WOPI editor) integration. The Storage API already hosts the WOPI
// endpoints Collabora needs (GET/POST /wopi/files/{fileID}...); this client only
// resolves *which* Collabora action (edit/view) handles a given file extension via
// Collabora's own discovery.xml, and relays the session YFS-Main-API mints
// (POST /files/wopi/session/create/{to_write} — see files.ts).

export const COLLABORA_BASE_URL = "https://collabora.your-domain.tld";
const DISCOVERY_URL = `${COLLABORA_BASE_URL}/hosting/discovery`;

// Fallback used when discovery.xml can't be fetched client-side (confirmed CORS-blocked
// from the app's own origin as of 2026-09-17 — Collabora's Caddy front-end doesn't send
// Access-Control-Allow-Origin on that path). Every <action> in this deployment's
// discovery.xml — every extension, every app (Writer/Calc/Impress/PDF) — resolves to
// this exact same urlsrc, since this Collabora build serves one unified loader for all
// document types and switches view/edit via the WOPI session, not the discovery action.
// Safe to fall back to unconditionally for any extension COLLABORA_EXTENSIONS already
// allows (fileType.ts), since discovery isn't telling us anything more specific here.
//
// This hash (`cc5614c67e`) is Collabora's static-assets build id and WILL go stale on
// the next Collabora upgrade — if this fallback ever gets exercised and Collabora fails
// to load, open https://collabora.your-domain.tld/hosting/discovery directly in
// a browser tab (that always works, CORS or not) and copy the current urlsrc from any
// <action> line.
const FALLBACK_LOADER_URL = "https://collabora.your-domain.tld/browser/cc5614c67e/cool.html?";

export interface CollaboraAction {
  urlsrc: string;
  name: string;
}

// Cached across the whole session — discovery.xml only changes when Collabora itself
// is upgraded, and it's ~45KB, not worth refetching per file opened. A failed fetch
// (network blip, CORS misconfig on the Collabora/Caddy side) clears the cache so the
// next attempt retries instead of being stuck on a rejected promise forever.
let discoveryPromise: Promise<Document> | null = null;

const fetchDiscovery = (): Promise<Document> => {
  if (!discoveryPromise) {
    discoveryPromise = fetch(DISCOVERY_URL, { credentials: "omit" })
      .then((res) => {
        if (!res.ok) throw new Error(`Collabora discovery request failed with status ${res.status}`);
        return res.text();
      })
      .then((xml) => {
        const doc = new DOMParser().parseFromString(xml, "text/xml");
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

// Finds the best <action> for `extension`: an editor when `wantEdit` is true and one
// exists, otherwise a read-only viewer — falling back to Collabora's "view_comment"
// action, which is what discovery.xml uses in place of a plain "view" for PDFs.
export const resolveCollaboraAction = async (
  extension: string,
  wantEdit: boolean
): Promise<CollaboraAction | null> => {
  let doc: Document;
  try {
    doc = await fetchDiscovery();
  } catch {
    // Discovery unreachable (CORS or network) — the caller already confirmed this
    // extension is Collabora-supported via isCollaboraSupported, so go straight to the
    // known-good loader URL rather than failing the whole viewer over an XML fetch.
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

// Collabora's discovery urlsrc already ends in "?" (e.g. ".../cool.html?") in every
// action we've seen, but build the separator defensively rather than assume it.
export const buildCollaboraActionUrl = (action: CollaboraAction, wopiSrc: string): string => {
  const sep = action.urlsrc.endsWith("?") || action.urlsrc.endsWith("&")
    ? ""
    : action.urlsrc.includes("?") ? "&" : "?";
  return `${action.urlsrc}${sep}WOPISrc=${encodeURIComponent(wopiSrc)}`;
};

export const collaboraClient = {
  requestSession(token: string, req: FileWopiRequest, toWrite: boolean): Promise<WopiSession> {
    return requestWopiSession(token, req, toWrite);
  },
};
