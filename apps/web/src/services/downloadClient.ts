import { requestFileDownload, type FileDownloadRequest, type DownloadSession } from "@yfs/service";

// Talks to the real download backend: ask YFS-Main-API for a per-file download
// session (POST /files/download -> token + Storage API URL), then GET the bytes
// from the Storage API directly with that token. Mirrors uploadClient.ts.

export const downloadClient = {
  requestSession(token: string, req: FileDownloadRequest): Promise<DownloadSession> {
    return requestFileDownload(token, req);
  },

  async fetchBytes(session: DownloadSession, signal?: AbortSignal): Promise<Blob> {
    // session.url already carries the grant as ?token=…, which the Storage API accepts on
    // its own. Only add an Authorization header when the URL lacks it: a header makes the
    // browser send a CORS preflight, and the server prefers the header over the query
    // string, so a wrong/missing header value would 401 an otherwise valid URL.
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
