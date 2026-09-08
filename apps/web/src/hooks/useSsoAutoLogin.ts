import { useEffect, useRef, useState } from "react";
import { AUTO_SSO_ATTEMPTED_KEY } from "../context/AuthContext";

// Whether auto-SSO has already been kicked off in this browser session. Persisted so
// the blocked-popup full-page redirect doesn't come back and immediately re-trigger.
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

// Auto-triggers SSO login shortly after mount when nobody is already authenticated.
// Runs AT MOST ONCE per browser session: if that attempt fails (bad API URL, CORS,
// popup blocked and the redirect returns still-unauthenticated, ...) the user lands on
// the login screen with a button instead of an endless popup/redirect loop. A
// successful sign-in or an explicit logout re-arms it (see AuthContext).
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
