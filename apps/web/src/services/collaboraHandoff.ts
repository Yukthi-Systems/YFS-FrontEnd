// Hands a live Collabora WOPI session off from the tab that minted it to the fresh
// tab "Open in new tab" opens at our own /collabora route (see CollaboraStandaloneView),
// without ever putting the access_token in a URL — same rationale CollaboraViewer's own
// hidden-form POST already follows (Collabora's own WOPI iframe guidance: the token
// belongs in a POST body, not a query string, so it can't land in browser history or a
// referrer header). localStorage is same-origin and readable from the new tab, but
// nothing else — the token still never crosses the network to us, only to Collabora.

const HANDOFF_PREFIX = "yfs_collabora_handoff_";
// Generous enough to cover the gap between window.open() and the new tab's first
// effect running, short enough that a handoff nobody ever consumed (new tab blocked by
// a popup blocker, user closed it immediately) doesn't linger in localStorage for long.
const HANDOFF_TTL_MS = 5 * 60 * 1000;

export interface CollaboraHandoff {
  actionUrl: string;
  accessToken: string;
  accessTokenTtl: number;
  fileName: string;
}

interface StoredHandoff extends CollaboraHandoff {
  createdAt: number;
}

// Stores the session and returns an opaque id — the only thing that goes in the new
// tab's URL (?h=<id>). Swallows storage failures (private browsing, quota, disabled)
// since the worst case is just the new tab showing "link expired" instead of a crash.
export const storeCollaboraHandoff = (data: CollaboraHandoff): string => {
  const id = crypto.randomUUID();
  try {
    const stored: StoredHandoff = { ...data, createdAt: Date.now() };
    localStorage.setItem(HANDOFF_PREFIX + id, JSON.stringify(stored));
  } catch {
    // Handled above.
  }
  return id;
};

// Single-use: reads and immediately deletes the entry, so the same link can't be
// replayed (refreshing /collabora?h=<id> after the first successful read correctly
// shows "expired" rather than re-POSTing a session that page already consumed) and
// rejects anything older than HANDOFF_TTL_MS.
export const consumeCollaboraHandoff = (id: string): CollaboraHandoff | null => {
  const key = HANDOFF_PREFIX + id;
  try {
    const raw = localStorage.getItem(key);
    localStorage.removeItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredHandoff;
    if (Date.now() - parsed.createdAt > HANDOFF_TTL_MS) return null;
    const { actionUrl, accessToken, accessTokenTtl, fileName } = parsed;
    return { actionUrl, accessToken, accessTokenTtl, fileName };
  } catch {
    return null;
  }
};
