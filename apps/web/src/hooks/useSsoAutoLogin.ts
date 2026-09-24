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

import { useEffect, useRef, useState } from "react";
import { AUTO_SSO_ATTEMPTED_KEY } from "../services/authStore";

// Survives the blocked-popup redirect so it doesn't re-trigger.
const autoSsoAlreadyAttempted = (): boolean => {
  try {
    return sessionStorage.getItem(AUTO_SSO_ATTEMPTED_KEY) === "1";
  } catch {
    return false;
  }
};

const markAutoSsoAttempted = (): void => {
  try {
    sessionStorage.setItem(AUTO_SSO_ATTEMPTED_KEY, "1");
  } catch {
    /* ignore */
  }
};

// Auto-starts SSO at most once per browser session, so a failure shows the login screen instead of looping.
export function useSsoAutoLogin({
  isAuthenticated,
  authLoading,
  loginWithSso,
  clearError,
}: {
  isAuthenticated: boolean;
  authLoading: boolean;
  loginWithSso: () => Promise<void>;
  clearError: () => void;
}) {
  const [ssoPending, setSsoPending] = useState(false);
  const startedRef = useRef(false);

  const searchParams = new URLSearchParams(window.location.search);
  const isLogoutParam = searchParams.get("logout") === "true";

  useEffect(() => {
    if (isAuthenticated || authLoading || isLogoutParam) return;
    if (startedRef.current || autoSsoAlreadyAttempted()) return;

    let active = true;
    const timer = setTimeout(async () => {
      if (!active) return;
      startedRef.current = true;
      markAutoSsoAttempted();
      try {
        setSsoPending(true);
        await loginWithSso();
      } catch (err) {
        console.warn("Auto SSO login was blocked or failed", err);
      } finally {
        if (active) setSsoPending(false);
      }
    }, 600);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isAuthenticated, authLoading, isLogoutParam, loginWithSso]);

  const handleManualLogin = async () => {
    try {
      setSsoPending(true);
      clearError();
      await loginWithSso();
    } catch (err) {
      console.error("Manual SSO login failed", err);
    } finally {
      setSsoPending(false);
    }
  };

  return { ssoPending, isLogoutParam, handleManualLogin };
}
