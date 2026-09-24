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
};

export type DownloadClient = typeof downloadClient;
