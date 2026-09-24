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

import { ssoLogout } from "@rjyspl/phoenix-sso-react";
import { apiRequest } from "./apiClient";
import type { AuthPayload, BackendUserInfo } from "./types";

// POST /auth/login — exchanges the SSO cookie for access and refresh tokens.
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

// GET /auth/session — throws HttpError(401) when the session is invalid.
export const fetchSession = async (accessToken: string): Promise<BackendUserInfo> => {
  const { data } = await apiRequest<BackendUserInfo>("/auth/session", { accessToken });
  return data;
};

// PATCH /auth/update-fcm-token — body is a bare JSON string.
export const updateFcmToken = async (accessToken: string, fcmToken: string): Promise<void> => {
  await apiRequest("/auth/update-fcm-token", {
    accessToken,
    method: "PATCH",
    parseJson: false,
    body: JSON.stringify(fcmToken),
  });
};

// POST /auth/refresh — also needs the SSO cookie.
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
