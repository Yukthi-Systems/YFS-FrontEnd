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
export type RuntimeEnvKey =
  | "VITE_API_URL"
  | "VITE_SSO_URL"
  | "VITE_SSO_APP_ID"
  | "VITE_STORAGE_URL"
  | "VITE_COLLABORA_URL"
  | "VITE_COLLABORA_LOADER_URL";

declare global {
  // Written at container start by env.sh into /env-config.js.
  var _env_: Partial<Record<RuntimeEnvKey, string>> | undefined;
}

// Runtime value (Docker) first, then Vite's build-time value (local dev).
export const readEnv = (key: RuntimeEnvKey): string => {
  const runtime = globalThis._env_?.[key];
  if (runtime) return runtime;
  try {
    return (import.meta.env[key] as string | undefined) ?? "";
  } catch {
    return "";
  }
};
