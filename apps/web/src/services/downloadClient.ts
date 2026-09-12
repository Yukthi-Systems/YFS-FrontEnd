import { requestFileDownload, type FileDownloadRequest, type DownloadSession } from "@yfs/service";

// Talks to the real download backend: ask YFS-Main-API for a per-file download
// session (POST /files/download -> token + Storage API URL), then GET the bytes
// from the Storage API directly with that token. Mirrors uploadClient.ts.

export const downloadClient = {
  requestSession(token: string, req: FileDownloadRequest): Promise<DownloadSession> {
    return requestFileDownload(token, req);
  },

  async fetchBytes(session: DownloadSession, signal?: AbortSignal): Promise<Blob> {
    const res = await fetch(session.url, {
      headers: { Authorization: `Bearer ${session.token}` },
      signal,
    });
    if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
    return res.blob();
  },
};

export type DownloadClient = typeof downloadClient;
