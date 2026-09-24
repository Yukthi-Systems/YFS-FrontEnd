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

import { useAtomValue } from "jotai";
import { userAtom, tokenAtom, userIdAtom, sessionExpiresAtAtom, isAuthLoadingAtom, authErrorMsgAtom } from "../atoms/auth";
import { loginWithSso, logout, clearError, refreshAccessToken } from "../services/authStore";

export type { UserInfo } from "../atoms/auth";

export const useAuth = () => {
  const user = useAtomValue(userAtom);
  const token = useAtomValue(tokenAtom);
  const userId = useAtomValue(userIdAtom);
  const isLoading = useAtomValue(isAuthLoadingAtom);
  const errorMsg = useAtomValue(authErrorMsgAtom);
  const sessionExpiresAt = useAtomValue(sessionExpiresAtAtom);

  return {
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
    sessionExpiresAt,
  };
};
