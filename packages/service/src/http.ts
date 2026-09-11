// Determine base URL dynamically depending on where it's running:
// 1. Vite (Web): import.meta.env.VITE_API_URL
// 2. React Native / Expo: process.env.EXPO_PUBLIC_API_URL
const getBaseUrl = (): string => {
  try {
    const url = import.meta.env.VITE_API_URL;
    if (url) {
      return url;
    }
  } catch {}

  try {
    const globalProcess = (globalThis as any).process;
    if (globalProcess && globalProcess.env && globalProcess.env.EXPO_PUBLIC_API_URL) {
      return globalProcess.env.EXPO_PUBLIC_API_URL;
    }
  } catch {}

  return "";
};

export const API_BASE_URL = getBaseUrl();

// A missing API base URL is the classic broken-deploy cause: every /auth/* call then
// hits the static host that serves the SPA, returns index.html, and the auth flow
// retries forever. Fail loudly instead of silently making same-origin requests.
if (!API_BASE_URL) {
  const msg =
    "VITE_API_URL is not set — API calls will hit the app's own origin and fail. " +
    "Set it at build time (apps/web/.env or a Docker build arg).";
  try {
    if (typeof window !== "undefined") console.error(`[yfs] ${msg}`);
  } catch {}
}

export function getApiUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, "");
  const relative = path.replace(/^\//, "");
  return base ? `${base}/${relative}` : relative;
}

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = "";
    try {
      const text = await res.text();
      try {
        const parsed = JSON.parse(text);
        message = typeof parsed?.error === "string" ? parsed.error : text;
      } catch {
        message = text;
      }
    } catch {
      /* body already consumed / unavailable */
    }
    throw new HttpError(res.status, message || `GET ${url} failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getApiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const url = getApiUrl(path);
  return getJson<T>(url, options);
}
