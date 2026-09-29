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

import { requestFileDownload, type FileDownloadRequest, type DownloadSession } from "@yfs/service";

// Gets a download session from YFS-Main-API, then fetches the bytes from the Storage API.

export const downloadClient = {
  requestSession(token: string, req: FileDownloadRequest): Promise<DownloadSession> {
    return requestFileDownload(token, req);
  },

  async fetchBytes(session: DownloadSession, signal?: AbortSignal): Promise<Blob> {
    // Only add Authorization when the URL has no ?token=: the header forces a preflight and takes precedence.
    const hasUrlToken = new URL(session.url, window.location.href).searchParams.has("token");
    const res = await fetch(session.url, {
      headers: hasUrlToken || !session.token ? undefined : { Authorization: `Bearer ${session.token}` },
      signal,
    });
    if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
    return res.blob();
  },

  // Fetches just the first `length` bytes, for a signature check before committing to a full
  // download. Falls back to slicing a full response if the storage backend ignores Range.
  async fetchHeader(session: DownloadSession, length: number, signal?: AbortSignal): Promise<Uint8Array> {
    const hasUrlToken = new URL(session.url, window.location.href).searchParams.has("token");
    const res = await fetch(session.url, {
      headers: {
        ...(hasUrlToken || !session.token ? {} : { Authorization: `Bearer ${session.token}` }),
        Range: `bytes=0-${length - 1}`,
      },
      signal,
    });
    if (!res.ok && res.status !== 206) throw new Error(`Download failed with status ${res.status}`);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf).slice(0, length);
  },
};

export type DownloadClient = typeof downloadClient;
