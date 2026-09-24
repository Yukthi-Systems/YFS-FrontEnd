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

// Passes a Collabora session to the /collabora tab via localStorage so the access_token never appears in a URL.

const HANDOFF_PREFIX = "yfs_collabora_handoff_";
// Covers the gap until the new tab reads it, without lingering if it never does.
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

// Returns the id for ?h=. Storage failures just make the new tab show "expired".
export const storeCollaboraHandoff = (data: CollaboraHandoff): string => {
  const id = crypto.randomUUID();
  try {
    const stored: StoredHandoff = { ...data, createdAt: Date.now() };
    localStorage.setItem(HANDOFF_PREFIX + id, JSON.stringify(stored));
  } catch {
  }
  return id;
};

// Single-use and time-limited.
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
