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

import { readEnv } from "./env";

// VITE_API_URL on web (runtime or build time), EXPO_PUBLIC_API_URL on Expo.
const getBaseUrl = (): string => {
  const url = readEnv("VITE_API_URL");
  if (url) return url;

  try {
    const globalProcess = (globalThis as any).process;
    if (globalProcess && globalProcess.env && globalProcess.env.EXPO_PUBLIC_API_URL) {
      return globalProcess.env.EXPO_PUBLIC_API_URL;
    }
  } catch {}

  return "";
};

export const API_BASE_URL = getBaseUrl();

// Without a base URL every call would hit the SPA host and get index.html; fail loudly.
if (!API_BASE_URL) {
  const msg =
    "VITE_API_URL is not set — API calls will hit the app's own origin and fail. " +
    "Set it in apps/web/.env for dev, or as a container environment variable.";
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
