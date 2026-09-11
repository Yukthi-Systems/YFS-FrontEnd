import { atom } from "jotai";

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

// Written by services/authStore.ts, read via hooks/useAuth.ts. `null as T | null`
// rather than `atom<T | null>(null)` — see atoms/fileSystem.ts for why.
export const userAtom = atom(null as UserInfo | null);
export const tokenAtom = atom(null as string | null);
export const userIdAtom = atom(null as string | null);
export const sessionExpiresAtAtom = atom(null as number | null);
export const isAuthLoadingAtom = atom<boolean>(true);
export const authErrorMsgAtom = atom(null as string | null);
