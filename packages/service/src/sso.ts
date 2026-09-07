import {
  openLoginPopup,
  redirectToLogin,
  checkSilentAuth,
  PopupBlockedError,
} from "@rjyspl/phoenix-sso-react";
import { ssoLogin } from "./auth";
import type { BackendUserInfo, SsoProfile } from "./types";

// App identifier registered with the Yukthi SSO service.
export const SSO_APP_ID = import.meta.env.VITE_SSO_APP_ID || "chat";

// Appended to the return URL when a blocked popup forces a full-page SSO redirect.
// Its presence on the next load means the SSO cookie is already set, so we skip the
// popup and go straight to the backend token exchange.
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

// The SSO silent-auth check posts the signed-in user's session payload back to us.
// Field names vary, so read both snake_case and camelCase and look one level deep.
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

// Exchange the SSO-Session-ID cookie for a YFS access token, and enrich it with
// whatever profile the SSO silent-auth check exposes. `ssoPayload` lets a caller
// that already ran the silent check pass its result instead of re-running it.
const completeSsoLogin = async (ssoUrl: string, ssoPayload?: unknown): Promise<SsoAuthResponse> => {
  let profileSource = ssoPayload;
  if (profileSource === undefined) {
    try {
      profileSource = await checkSilentAuth(trimUrl(ssoUrl), SSO_APP_ID);
    } catch {
      profileSource = null; // silent check is best-effort; /auth/login is the source of truth
    }
  }

  const payload = await ssoLogin();
  return { data: { ...payload, sso_profile: extractSsoProfile(profileSource) } };
};

// Interactive login. Opens the SSO popup (falling back to a full-page redirect if the
// browser blocks it), then runs the backend token exchange. Also handles the case where
// we've just landed back from that redirect.
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

// Non-interactive login used on app start: if the SSO service already has a live
// session (cookie present), exchange it for a YFS token. Rejects when there's no
// session — the caller then shows the login screen.
export const silentSsoAuthenticate = async (ssoUrl: string): Promise<SsoAuthResponse> => {
  const ssoPayload = await checkSilentAuth(trimUrl(ssoUrl), SSO_APP_ID);
  return completeSsoLogin(ssoUrl, ssoPayload);
};

// True right after a blocked-popup redirect brought the user back to the app.
export const isReturningFromSsoRedirect = (): boolean =>
  new URLSearchParams(window.location.search).get(SSO_REDIRECT_PARAM) === "1";
