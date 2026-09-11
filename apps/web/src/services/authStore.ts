import { getDefaultStore } from "jotai";
import {
  openSsoPopupAndAuthenticate,
  silentSsoAuthenticate,
  isReturningFromSsoRedirect,
  logout as apiLogout,
  fetchSession,
  refreshSession,
  HttpError,
} from "@yfs/service";
import type { AuthPayload, BackendUserInfo, SsoProfile } from "@yfs/service";
import {
  userAtom,
  tokenAtom,
  userIdAtom,
  refreshTokenAtom,
  sessionExpiresAtAtom,
  isAuthLoadingAtom,
  authErrorMsgAtom,
  type UserInfo,
} from "../atoms/auth";
import { showToast } from "../atoms/toast";

// Session singleton: SSO/token-refresh orchestration. Reactive state lives in
// atoms/auth.ts (persisted to localStorage); components read it via hooks/useAuth.ts
// and it's booted once by components/AuthBridge.tsx.

const store = getDefaultStore();

// Set once per browser session the first time auto-SSO is kicked off. It survives a
// full-page redirect (blocked-popup fallback) so that a login that keeps failing —
// bad API URL, CORS, expired SSO session — drops the user on the login screen instead
// of retriggering the popup/redirect forever. Cleared only on a successful sign-in or
// an explicit logout (NOT in clearSession, which also runs on every failed attempt).
// Tab-scoped (sessionStorage) on purpose — unrelated to the persisted session itself.
export const AUTO_SSO_ATTEMPTED_KEY = "yfs_sso_auto_attempted";

const clearAutoSsoAttempt = () => {
  try {
    sessionStorage.removeItem(AUTO_SSO_ATTEMPTED_KEY);
  } catch {
    /* ignore */
  }
};

const buildUser = (info: BackendUserInfo, profile: SsoProfile | undefined, prev: UserInfo | null): UserInfo => {
  const firstName = profile?.first_name ?? prev?.first_name;
  const lastName = profile?.last_name ?? prev?.last_name;
  const phone = profile?.phone ?? prev?.phone;
  const twoFactorMethods = profile?.two_factor_methods ?? prev?.two_factor_methods;
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    email: info.email,
    user_id: info.user_id,
    domain_name: info.domain_name,
    organization_id: info.organization_id,
    organization_name: info.organization_name,
    is_file_versioning_enabled: info.is_file_versioning_enabled,
    is_sharing_enabled: info.is_sharing_enabled,
    enable_file_sharing: info.is_sharing_enabled,
    quota_allocated: info.quota_allocated,
    quota_utilized: info.quota_utilized,
    first_name: firstName,
    last_name: lastName,
    phone,
    two_factor_methods: twoFactorMethods,
    id: 0,
    username: fullName || info.email.split("@")[0],
  };
};

export const ssoUrl = import.meta.env.VITE_SSO_URL || "https://sso.your-domain.tld";

const persistPayload = (payload: AuthPayload, profile?: SsoProfile) => {
  const nextUser = buildUser(payload.user_info, profile ?? payload.sso_profile, store.get(userAtom));
  const nextRefresh = payload.refresh_token ?? store.get(refreshTokenAtom);
  // /auth/refresh may omit X-Session-Expiry — keep the last known expiry then.
  const expiresAt = payload.expires_in ? Date.now() + payload.expires_in * 1000 : store.get(sessionExpiresAtAtom);

  store.set(tokenAtom, payload.access_token);
  store.set(refreshTokenAtom, nextRefresh);
  store.set(userIdAtom, payload.user_info.user_id);
  store.set(userAtom, nextUser);
  store.set(sessionExpiresAtAtom, expiresAt);
  // Signed in — a future auto-SSO attempt (e.g. after the session later expires) is
  // allowed again.
  clearAutoSsoAttempt();
};

const clearSession = () => {
  store.set(tokenAtom, null);
  store.set(refreshTokenAtom, null);
  store.set(userIdAtom, null);
  store.set(userAtom, null);
  store.set(sessionExpiresAtAtom, null);
  try {
    localStorage.removeItem("yfs_fs_cache");
  } catch {
    /* ignore */
  }
};

// Single-flight: concurrent 401s (e.g. several list calls firing at once on boot)
// must share ONE /auth/refresh, not each rotate the refresh token.
let refreshInFlight: Promise<string | null> | null = null;

export const refreshAccessToken = (): Promise<string | null> => {
  if (refreshInFlight) return refreshInFlight;

  const run = (async (): Promise<string | null> => {
    const curToken = store.get(tokenAtom);
    const curRefresh = store.get(refreshTokenAtom);
    const curUserId = store.get(userIdAtom);
    if (!curToken || !curRefresh || !curUserId) {
      clearSession();
      return null;
    }
    try {
      const payload = await refreshSession({ refreshToken: curRefresh, accessToken: curToken, userId: curUserId });
      persistPayload(payload);
      return payload.access_token;
    } catch (err) {
      console.warn("Session refresh failed, signing out:", err);
      clearSession();
      showToast("Your session has expired — please sign in again", "error");
      return null;
    }
  })();

  refreshInFlight = run;
  run.finally(() => {
    refreshInFlight = null;
  });
  return run;
};

// Boot sequence, run once on app start by AuthBridge. A cached session (already
// hydrated into the atoms from localStorage by the time this runs) renders
// immediately and is just verified/refreshed here in the background — isAuthLoadingAtom
// only gates rendering when there's nothing cached yet, so a refresh with an existing
// session never shows a "restoring session" blocker or visibly re-runs SSO.
// `signal.cancelled` lets the caller abandon a stale run (component unmounted).
export const bootAuth = async (signal: { cancelled: boolean }) => {
  const isLogoutParam = new URLSearchParams(window.location.search).get("logout") === "true";
  const cachedToken = store.get(tokenAtom);
  const hasCachedSession = !!cachedToken && !!store.get(userIdAtom);

  if (!hasCachedSession) store.set(isAuthLoadingAtom, true);

  // Silent login: ask the SSO service (hidden iframe) whether a session already
  // exists and, if so, exchange its cookie for a YFS token — no popup.
  const trySilentLogin = async () => {
    try {
      const { data } = await silentSsoAuthenticate(ssoUrl);
      if (!signal.cancelled) persistPayload(data, data.sso_profile);
    } catch {
      // No live SSO session -> user simply isn't signed in yet.
      if (!signal.cancelled) clearSession();
    }
  };

  try {
    if (isReturningFromSsoRedirect()) {
      // Came back from a full-page SSO redirect (popup was blocked) — the cookie
      // is set now, so go straight to the backend exchange.
      try {
        const { data } = await openSsoPopupAndAuthenticate(ssoUrl);
        if (!signal.cancelled) persistPayload(data, data.sso_profile);
      } catch (err) {
        console.warn("SSO redirect-return login failed:", err);
        if (!signal.cancelled) {
          clearSession();
          store.set(authErrorMsgAtom, err instanceof Error ? err.message : "SSO sign-in could not be completed");
        }
      }
    } else if (hasCachedSession) {
      // Validate the cached token in the background; refresh once on 401.
      try {
        const info = await fetchSession(cachedToken!);
        if (!signal.cancelled) persistPayload({ access_token: cachedToken!, user_info: info });
      } catch (err) {
        if (signal.cancelled) return;
        if (err instanceof HttpError && (err.status === 401 || err.status === 400)) {
          const refreshed = await refreshAccessToken();
          if (!refreshed && !signal.cancelled && !isLogoutParam) await trySilentLogin();
        } else {
          console.warn("Could not verify cached session, keeping it for now:", err);
        }
      }
    } else if (!isLogoutParam) {
      await trySilentLogin();
    }
  } finally {
    if (!signal.cancelled) store.set(isAuthLoadingAtom, false);
  }
};

export const loginWithSso = async () => {
  store.set(isAuthLoadingAtom, true);
  store.set(authErrorMsgAtom, null);
  try {
    const { data } = await openSsoPopupAndAuthenticate(ssoUrl);
    persistPayload(data, data.sso_profile);

    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (err: unknown) {
    console.error("SSO authentication failed:", err);
    const message = err instanceof Error ? err.message : "SSO Authentication failed";
    store.set(authErrorMsgAtom, message);
    throw err;
  } finally {
    store.set(isAuthLoadingAtom, false);
  }
};

export const logout = async () => {
  store.set(isAuthLoadingAtom, true);
  const currentToken = store.get(tokenAtom);
  try {
    // apiLogout tears down the YFS session (DELETE /auth/logout) and then the SSO
    // session (ssoLogout from @rjyspl/phoenix-sso-react).
    await apiLogout(currentToken, ssoUrl);
  } catch (err) {
    console.error("Logout request failed:", err);
  } finally {
    clearSession();
    clearAutoSsoAttempt(); // explicit logout re-enables auto-SSO for the next visit
    store.set(isAuthLoadingAtom, false);

    if (!window.location.pathname.includes("/logout")) {
      window.location.search = "logout=true";
    }
  }
};

export const clearError = () => store.set(authErrorMsgAtom, null);
