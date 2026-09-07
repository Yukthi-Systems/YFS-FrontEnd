import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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

interface AuthContextType {
  user: UserInfo | null;
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  errorMsg: string | null;
  loginWithSso: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  // Forces an access-token refresh via POST /auth/refresh. Returns the new token,
  // or null if the session could not be renewed (caller should treat as logged out).
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Session-scoped only — nothing about the signed-in user is written to localStorage.
// A page reload re-validates against the API (or re-runs the cookie login).
const SS = {
  token: "yfs_token",
  refresh: "yfs_refresh_token",
  user: "yfs_user",
  userId: "yfs_user_id",
  expiresAt: "yfs_expires_at",
} as const;

// localStorage keys written by earlier builds; cleared on logout so they can't linger.
const LEGACY_LS_KEYS = ["yfs_token", "yfs_refresh_token", "yfs_user", "yfs_user_id", "yfs_expires_at", "yfs_files"];

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Latest values, readable from async callbacks without stale closures.
  const credsRef = useRef({
    token: null as string | null,
    refreshToken: null as string | null,
    userId: null as string | null,
    user: null as UserInfo | null,
  });
  credsRef.current = { token, refreshToken, userId, user };

  const ssoUrl = import.meta.env.VITE_SSO_URL || "https://sso.test.yukthi.net";

  const persistPayload = useCallback((payload: AuthPayload, profile?: SsoProfile) => {
    const nextUser = buildUser(payload.user_info, profile ?? payload.sso_profile, credsRef.current.user);
    const nextUserId = payload.user_info.user_id;
    const nextRefresh = payload.refresh_token ?? credsRef.current.refreshToken;
    const expiresAt = payload.expires_in ? Date.now() + payload.expires_in * 1000 : null;

    setToken(payload.access_token);
    setRefreshToken(nextRefresh);
    setUserId(nextUserId);
    setUser(nextUser);

    try {
      sessionStorage.setItem(SS.token, payload.access_token);
      sessionStorage.setItem(SS.user, JSON.stringify(nextUser));
      sessionStorage.setItem(SS.userId, nextUserId);
      if (nextRefresh) sessionStorage.setItem(SS.refresh, nextRefresh);
      if (expiresAt) sessionStorage.setItem(SS.expiresAt, String(expiresAt));
    } catch (err) {
      console.error("Failed to cache auth session:", err);
    }
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setRefreshToken(null);
    setUserId(null);
    setUser(null);
    try {
      Object.values(SS).forEach((key) => sessionStorage.removeItem(key));
      LEGACY_LS_KEYS.forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem("yfs_fs_cache");
    } catch {
      /* ignore */
    }
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const { token: curToken, refreshToken: curRefresh, userId: curUserId } = credsRef.current;
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
      return null;
    }
  }, [clearSession, persistPayload]);

  // On load: if the SSO cookie is present, log in through it. A cached session-storage
  // token short-circuits to a cheap /auth/session validation so a reload doesn't mint
  // a brand-new session every time.
  useEffect(() => {
    let cancelled = false;

    const isLogoutParam = new URLSearchParams(window.location.search).get("logout") === "true";

    (async () => {
      let cachedToken: string | null = null;
      try {
        cachedToken = sessionStorage.getItem(SS.token);
        const cachedUserJson = sessionStorage.getItem(SS.user);
        if (cachedToken && cachedUserJson) {
          setToken(cachedToken);
          setRefreshToken(sessionStorage.getItem(SS.refresh));
          setUserId(sessionStorage.getItem(SS.userId));
          const cachedUser = JSON.parse(cachedUserJson) as UserInfo;
          setUser(cachedUser);
          credsRef.current = {
            token: cachedToken,
            refreshToken: sessionStorage.getItem(SS.refresh),
            userId: sessionStorage.getItem(SS.userId),
            user: cachedUser,
          };
        }
      } catch (err) {
        console.error("Failed to read cached session:", err);
      }

      // Silent login: ask the SSO service (hidden iframe) whether a session already
      // exists and, if so, exchange its cookie for a YFS token — no popup.
      const trySilentLogin = async () => {
        try {
          const { data } = await silentSsoAuthenticate(ssoUrl);
          if (!cancelled) persistPayload(data, data.sso_profile);
        } catch {
          // No live SSO session -> user simply isn't signed in yet.
          if (!cancelled) clearSession();
        }
      };

      try {
        if (isReturningFromSsoRedirect()) {
          // Came back from a full-page SSO redirect (popup was blocked) — the cookie
          // is set now, so go straight to the backend exchange.
          try {
            const { data } = await openSsoPopupAndAuthenticate(ssoUrl);
            if (!cancelled) persistPayload(data, data.sso_profile);
          } catch (err) {
            console.warn("SSO redirect-return login failed:", err);
            if (!cancelled) clearSession();
          }
        } else if (cachedToken) {
          // Validate the cached token; refresh once on 401 before giving up.
          try {
            const info = await fetchSession(cachedToken);
            if (!cancelled) persistPayload({ access_token: cachedToken, user_info: info });
          } catch (err) {
            if (cancelled) return;
            if (err instanceof HttpError && (err.status === 401 || err.status === 400)) {
              const refreshed = await refreshAccessToken();
              if (!refreshed && !cancelled && !isLogoutParam) await trySilentLogin();
            } else {
              console.warn("Could not verify cached session, keeping it for now:", err);
            }
          }
        } else if (!isLogoutParam) {
          await trySilentLogin();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ssoUrl, persistPayload, refreshAccessToken, clearSession]);

  const loginWithSso = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data } = await openSsoPopupAndAuthenticate(ssoUrl);
      persistPayload(data, data.sso_profile);

      if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err: unknown) {
      console.error("SSO authentication failed:", err);
      const message = err instanceof Error ? err.message : "SSO Authentication failed";
      setErrorMsg(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    const currentToken = credsRef.current.token;
    try {
      // apiLogout tears down the YFS session (DELETE /auth/logout) and then the SSO
      // session (ssoLogout from @rjyspl/phoenix-sso-react).
      await apiLogout(currentToken, ssoUrl);
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      clearSession();
      setIsLoading(false);

      if (!window.location.pathname.includes("/logout")) {
        window.location.search = "logout=true";
      }
    }
  };

  const clearError = () => setErrorMsg(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        userId,
        isAuthenticated: !!token,
        isLoading,
        errorMsg,
        loginWithSso,
        logout,
        clearError,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
