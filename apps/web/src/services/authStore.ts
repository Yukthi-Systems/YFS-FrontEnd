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

import { getDefaultStore } from "jotai";
import {
  openSsoPopupAndAuthenticate,
  silentSsoAuthenticate,
  isReturningFromSsoRedirect,
  logout as apiLogout,
  fetchSession,
  refreshSession,
  HttpError,
  readEnv,
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

// Session singleton: SSO and token refresh. State lives in atoms/auth.ts; booted by AuthBridge.

const store = getDefaultStore();

// Stops a failing auto-SSO from looping across redirects; cleared on successful sign-in or explicit logout.
export const AUTO_SSO_ATTEMPTED_KEY = "yfs_sso_auto_attempted";

const clearAutoSsoAttempt = () => {
  try {
    sessionStorage.removeItem(AUTO_SSO_ATTEMPTED_KEY);
  } catch {
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

export const ssoUrl = readEnv("VITE_SSO_URL");

const persistPayload = (payload: AuthPayload, profile?: SsoProfile) => {
  const nextUser = buildUser(payload.user_info, profile ?? payload.sso_profile, store.get(userAtom));
  const nextRefresh = payload.refresh_token ?? store.get(refreshTokenAtom);
  const expiresAt = payload.expires_in ? Date.now() + payload.expires_in * 1000 : store.get(sessionExpiresAtAtom);

  store.set(tokenAtom, payload.access_token);
  store.set(refreshTokenAtom, nextRefresh);
  store.set(userIdAtom, payload.user_info.user_id);
  store.set(userAtom, nextUser);
  store.set(sessionExpiresAtAtom, expiresAt);
  clearAutoSsoAttempt();
  scheduleProactiveRefresh();
};

const clearSession = () => {
  store.set(tokenAtom, null);
  store.set(refreshTokenAtom, null);
  store.set(userIdAtom, null);
  store.set(userAtom, null);
  store.set(sessionExpiresAtAtom, null);
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  try {
    localStorage.removeItem("yfs_fs_cache");
  } catch {
  }
};

// Refresh ahead of expiry; withAuthRetry stays as the fallback.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const REFRESH_SKEW_MS = 60_000;

const scheduleProactiveRefresh = () => {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  const expiresAt = store.get(sessionExpiresAtAtom);
  if (!expiresAt) return;
  const delay = Math.max(0, expiresAt - Date.now() - REFRESH_SKEW_MS);
  refreshTimer = setTimeout(() => {
    refreshAccessToken();
  }, delay);
};

// Single-flight: concurrent 401s share one refresh.
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

// Runs once on start. A cached session renders immediately and is verified in the background.
export const bootAuth = async (signal: { cancelled: boolean }) => {
  const isLogoutParam = new URLSearchParams(window.location.search).get("logout") === "true";
  const cachedToken = store.get(tokenAtom);
  const hasCachedSession = !!cachedToken && !!store.get(userIdAtom);

  if (!hasCachedSession) store.set(isAuthLoadingAtom, true);

  // Silent login via the SSO iframe; no popup.
  const trySilentLogin = async () => {
    try {
      const { data } = await silentSsoAuthenticate(ssoUrl);
      if (!signal.cancelled) persistPayload(data, data.sso_profile);
    } catch {
      if (!signal.cancelled) clearSession();
    }
  };

  try {
    if (isReturningFromSsoRedirect()) {
      // Back from a full-page SSO redirect; the cookie is set.
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
    await apiLogout(currentToken, ssoUrl);
  } catch (err) {
    console.error("Logout request failed:", err);
  } finally {
    clearSession();
    clearAutoSsoAttempt();
    store.set(isAuthLoadingAtom, false);

    if (!window.location.pathname.includes("/logout")) {
      window.location.search = "logout=true";
    }
  }
};

export const clearError = () => store.set(authErrorMsgAtom, null);
