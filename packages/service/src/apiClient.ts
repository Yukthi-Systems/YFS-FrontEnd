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

import { getApiUrl, HttpError } from "./http";

// Header the API expects the short-lived access token in (see middleware/auth.rs).
export const SESSION_HEADER = "x-session-access-id";

export interface ApiRequestOptions extends Omit<RequestInit, "headers"> {
  // Omit for unauthenticated calls.
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

// Every YFS-Main-API call; credentials are sent so the SSO cookie rides along.
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
    // Errors are always `{ "error": "<message>" }`.
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
    throw new HttpError(res.status, message || `${init.method || "GET"} ${path} failed with status ${res.status}`);
  }

  let data = undefined as T;
  if (parseJson) {
    const text = await res.text();
    data = (text ? JSON.parse(text) : undefined) as T;
  }

  return { data, headers: pickedHeaders, status: res.status };
}
