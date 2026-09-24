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
import {
  openLoginPopup,
  redirectToLogin,
  checkSilentAuth,
  PopupBlockedError,
} from "@rjyspl/phoenix-sso-react";
import { ssoLogin } from "./auth";
import type { BackendUserInfo, SsoProfile } from "./types";

// App identifier registered with the Yukthi SSO service.
export const SSO_APP_ID = readEnv("VITE_SSO_APP_ID");

// Added to the return URL after a blocked-popup redirect; the SSO cookie is already set on return.
export const SSO_REDIRECT_PARAM = "sso_redirect";

const trimUrl = (url: string) => url.replace(/\/$/, "");

export interface SsoAuthResponse {
  data: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    user_info: BackendUserInfo;
    sso_profile?: SsoProfile;
  };
}

// Field names vary, so read snake_case and camelCase, one level deep.
export const extractSsoProfile = (message: unknown): SsoProfile => {
  const data = (message ?? {}) as Record<string, unknown>;
  const source = {
    ...data,
    ...((data.payload as Record<string, unknown>) ?? {}),
    ...((data.user as Record<string, unknown>) ?? {}),
    ...((data.user_info as Record<string, unknown>) ?? {}),
    ...((data.profile as Record<string, unknown>) ?? {}),
  } as Record<string, unknown>;

  const str = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return undefined;
  };

  const methods = (): string[] | undefined => {
    const raw =
      source.two_factor_methods ??
      source.twoFactorMethods ??
      source.mfa_methods ??
      source["2fa_methods"] ??
      source.two_factor;
    if (Array.isArray(raw)) return raw.map((m) => String(m)).filter(Boolean);
    if (raw && typeof raw === "object") {
      return Object.entries(raw as Record<string, unknown>)
        .filter(([, enabled]) => Boolean(enabled))
        .map(([name]) => name);
    }
    if (typeof raw === "string" && raw.trim()) return raw.split(/[,\s]+/).filter(Boolean);
    return undefined;
  };

  const fullName = str("name", "full_name", "fullName", "display_name", "displayName");
  const [derivedFirst, ...derivedRest] = fullName ? fullName.split(" ") : [];

  return {
    first_name: str("first_name", "firstName", "given_name", "givenName") ?? derivedFirst,
    last_name:
      str("last_name", "lastName", "family_name", "familyName", "surname") ??
      (derivedRest.length ? derivedRest.join(" ") : undefined),
    phone: str("phone", "phone_number", "phoneNumber", "primary_phone", "mobile", "mobile_number", "contact_number"),
    two_factor_methods: methods(),
  };
};

// Exchanges the SSO cookie for a YFS token. Pass `ssoPayload` to skip re-running the silent check.
const completeSsoLogin = async (ssoUrl: string, ssoPayload?: unknown): Promise<SsoAuthResponse> => {
  let profileSource = ssoPayload;
  if (profileSource === undefined) {
    try {
      profileSource = await checkSilentAuth(trimUrl(ssoUrl), SSO_APP_ID);
    } catch {
      profileSource = null; // best-effort; /auth/login is authoritative
    }
  }

  const payload = await ssoLogin();
  return { data: { ...payload, sso_profile: extractSsoProfile(profileSource) } };
};

// Popup login, falling back to a full-page redirect when blocked.
export const openSsoPopupAndAuthenticate = async (ssoUrl: string): Promise<SsoAuthResponse> => {
  const url = new URL(window.location.href);
  if (url.searchParams.get(SSO_REDIRECT_PARAM) === "1") {
    url.searchParams.delete(SSO_REDIRECT_PARAM);
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    return completeSsoLogin(ssoUrl);
  }

  try {
    await openLoginPopup(trimUrl(ssoUrl), SSO_APP_ID, { width: 500, height: 650 });
  } catch (err) {
    if (err instanceof PopupBlockedError) {
      const returnTo = new URL(window.location.href);
      returnTo.searchParams.set(SSO_REDIRECT_PARAM, "1");
      redirectToLogin(trimUrl(ssoUrl), SSO_APP_ID, { returnTo: returnTo.toString() });
      return new Promise<SsoAuthResponse>(() => {}); // page is navigating away
    }
    throw err;
  }

  return completeSsoLogin(ssoUrl);
};

// Exchanges an existing SSO session for a token; rejects when there's none.
export const silentSsoAuthenticate = async (ssoUrl: string): Promise<SsoAuthResponse> => {
  const ssoPayload = await checkSilentAuth(trimUrl(ssoUrl), SSO_APP_ID);
  return completeSsoLogin(ssoUrl, ssoPayload);
};

// True right after a blocked-popup redirect brought the user back to the app.
export const isReturningFromSsoRedirect = (): boolean =>
  new URLSearchParams(window.location.search).get(SSO_REDIRECT_PARAM) === "1";
