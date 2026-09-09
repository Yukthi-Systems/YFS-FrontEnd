import { ssoLogout } from "@rjyspl/phoenix-sso-react";
import { apiRequest } from "./apiClient";
import type { AuthPayload, BackendUserInfo } from "./types";

// POST /auth/login — exchanges the SSO-Session-ID cookie (already set by the SSO
// service after the popup flow) for a YFS access token + refresh token.
export const ssoLogin = async (): Promise<AuthPayload> => {
  const { data, headers } = await apiRequest<{ access_token: string; user_info: BackendUserInfo }>(
    "/auth/login",
    { method: "POST" }
  );

  return {
    access_token: data.access_token,
    refresh_token: headers["x-refresh-id-token"],
    expires_in: headers["x-session-expiry"] ? Number(headers["x-session-expiry"]) : undefined,
    user_info: data.user_info,
  };
};

// GET /auth/session — validates the current access token and returns fresh user info.
// Throws HttpError(401) when the session is no longer valid.
export const fetchSession = async (accessToken: string): Promise<BackendUserInfo> => {
  const { data } = await apiRequest<BackendUserInfo>("/auth/session", { accessToken });
  return data;
};

// PATCH /auth/update-fcm-token — registers a push token for this session (body is a
// bare JSON string). The web client has no push channel today, so this is only
// called if a service worker later provides a token.
export const updateFcmToken = async (accessToken: string, fcmToken: string): Promise<void> => {
  await apiRequest("/auth/update-fcm-token", {
    accessToken,
    method: "PATCH",
    parseJson: false,
    body: JSON.stringify(fcmToken),
  });
};

// POST /auth/refresh — issues a new access token for an existing refresh token.
// Needs the SSO-Session-ID cookie too (sent automatically via credentials: "include").
export const refreshSession = async (params: {
  refreshToken: string;
  accessToken: string;
  userId: string;
}): Promise<AuthPayload> => {
  const { data, headers } = await apiRequest<{ access_token: string; user_info: BackendUserInfo }>(
    "/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({
        refresh_token: params.refreshToken,
        access_token: params.accessToken,
        user_id: params.userId,
      }),
    }
  );

  return {
    access_token: data.access_token,
    refresh_token: params.refreshToken,
    expires_in: headers["x-session-expiry"] ? Number(headers["x-session-expiry"]) : undefined,
    user_info: data.user_info,
  };
};

// Tears down the YFS session (DELETE /auth/logout) and then clears the SSO cookies.
export const logout = async (accessToken: string | null, ssoUrl: string): Promise<void> => {
  if (accessToken) {
    try {
      await apiRequest("/auth/logout", { method: "DELETE", accessToken, parseJson: false });
    } catch (err) {
      console.error("YFS API logout failed", err);
    }
  }

  try {
    await ssoLogout(ssoUrl.replace(/\/$/, ""));
  } catch (err) {
    console.error("SSO logout failed", err);
  }
};
