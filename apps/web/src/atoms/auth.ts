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

// Written by services/authStore.ts, read via hooks/useAuth.ts. Persisted to
// localStorage so a refresh renders the signed-in UI immediately from the cached
// session instead of blocking on a server round-trip first — services/authStore.ts
// still verifies the session in the background and signs out if it's no longer
// valid. `getOnInit: true` because atomWithStorage otherwise defaults to returning
// the initial value (null) on first read and only hydrates from storage after
// mount — without it, the very first render would see "signed out" regardless of
// what's cached, for exactly one tick.
const persisted = { getOnInit: true } as const;
export const userAtom = atomWithStorage<UserInfo | null>("yfs_user", null, undefined, persisted);
export const tokenAtom = atomWithStorage<string | null>("yfs_token", null, undefined, persisted);
export const userIdAtom = atomWithStorage<string | null>("yfs_user_id", null, undefined, persisted);
export const refreshTokenAtom = atomWithStorage<string | null>("yfs_refresh_token", null, undefined, persisted);
export const sessionExpiresAtAtom = atomWithStorage<number | null>("yfs_expires_at", null, undefined, persisted);

// Not persisted — only true while there's no cached session to render
// optimistically and a silent-login check is in flight (see bootAuth).
export const isAuthLoadingAtom = atom<boolean>(false);
export const authErrorMsgAtom = atom(null as string | null);
