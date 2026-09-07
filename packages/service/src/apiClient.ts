import { getApiUrl, HttpError } from "./http";

// Header the API expects the short-lived access token in (see middleware/auth.rs).
export const SESSION_HEADER = "x-session-access-id";

export interface ApiRequestOptions extends Omit<RequestInit, "headers"> {
  // Access token to send in the SESSION_HEADER. Omit for unauthenticated calls
  // (e.g. /auth/login, which authenticates via the SSO-Session-ID cookie instead).
  accessToken?: string | null;
  headers?: Record<string, string>;
  // Parse and return the JSON body. When false, the raw Response is returned.
  parseJson?: boolean;
}

export interface ApiResult<T> {
  data: T;
  // Selected response headers the callers care about (lower-cased keys).
  headers: Record<string, string>;
  status: number;
}

const EXPOSED_HEADERS = ["x-refresh-id-token", "x-session-expiry"];

// Single entry point for every authenticated call to YFS-Main-API. Always sends
// credentials so the SSO-Session-ID cookie rides along (needed by /auth/login,
// /auth/refresh and the session-validity check inside /auth/session).
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiResult<T>> {
  const { accessToken, headers = {}, parseJson = true, ...init } = options;

  const finalHeaders: Record<string, string> = {
    accept: "application/json",
    ...headers,
  };
  if (accessToken) {
    finalHeaders[SESSION_HEADER] = accessToken;
  }
  if (init.body !== undefined && !("content-type" in finalHeaders) && !("Content-Type" in finalHeaders)) {
    finalHeaders["content-type"] = "application/json";
  }

  const res = await fetch(getApiUrl(path), {
    credentials: "include",
    ...init,
    headers: finalHeaders,
  });

  const pickedHeaders: Record<string, string> = {};
  for (const key of EXPOSED_HEADERS) {
    const value = res.headers.get(key);
    if (value !== null) pickedHeaders[key] = value;
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* body already consumed / unavailable */
    }
    throw new HttpError(res.status, detail || `${init.method || "GET"} ${path} failed with status ${res.status}`);
  }

  let data = undefined as T;
  if (parseJson) {
    const text = await res.text();
    data = (text ? JSON.parse(text) : undefined) as T;
  }

  return { data, headers: pickedHeaders, status: res.status };
}
