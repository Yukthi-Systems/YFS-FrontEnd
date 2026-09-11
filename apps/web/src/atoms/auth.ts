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

// Reactive session state, written by services/authStore.ts (the only place with write
// access) and wired up once by components/AuthBridge.tsx; read anywhere via
// hooks/useAuth.ts. `atom(null as T | null)` rather than `atom<T | null>(null)`: this
// repo builds with strictNullChecks off, so a bare `null` argument is structurally
// assignable to jotai's `Read<Value>` (a function type) and overload resolution would
// otherwise pick the read-only `atom(read): Atom<Value>` overload instead of the
// primitive (writable) one. See atoms/fileSystem.ts for the same fix.
export const userAtom = atom(null as UserInfo | null);
export const tokenAtom = atom(null as string | null);
export const userIdAtom = atom(null as string | null);
export const sessionExpiresAtAtom = atom(null as number | null);
export const isAuthLoadingAtom = atom<boolean>(true);
export const authErrorMsgAtom = atom(null as string | null);
