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

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface UserInfo {
  email: string;
  user_id?: string;
  domain_name?: string;
  organization_id?: string;
  organization_name?: string;
  enable_file_sharing?: boolean;
  is_file_versioning_enabled?: boolean;
  is_sharing_enabled?: boolean;
  quota_allocated?: number;
  quota_utilized?: number;
  // From the SSO popup (see @yfs/service extractSsoProfile) — session-lived only.
  first_name?: string;
  last_name?: string;
  phone?: string;
  two_factor_methods?: string[];
  id?: number;
  username?: string;
}

// Persisted for an instant signed-in render. `getOnInit: true` is required, or the first render reads null.
const persisted = { getOnInit: true } as const;
export const userAtom = atomWithStorage<UserInfo | null>("yfs_user", null, undefined, persisted);
export const tokenAtom = atomWithStorage<string | null>("yfs_token", null, undefined, persisted);
export const userIdAtom = atomWithStorage<string | null>("yfs_user_id", null, undefined, persisted);
export const refreshTokenAtom = atomWithStorage<string | null>("yfs_refresh_token", null, undefined, persisted);
export const sessionExpiresAtAtom = atomWithStorage<number | null>("yfs_expires_at", null, undefined, persisted);

// True only while a silent login runs with no cached session.
export const isAuthLoadingAtom = atom<boolean>(false);
export const authErrorMsgAtom = atom(null as string | null);
