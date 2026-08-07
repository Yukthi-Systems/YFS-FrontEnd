import { useEffect, useState } from "react";

// Auto-triggers SSO login shortly after mount when nobody is already authenticated
// (skipped if we just logged out via ?logout=true, to avoid immediately logging back in).
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

  const searchParams = new URLSearchParams(window.location.search);
  const isLogoutParam = searchParams.get("logout") === "true";

  useEffect(() => {
    if (isAuthenticated || authLoading || isLogoutParam) return;

    let active = true;
    const triggerAutoSso = async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (!active) return;
      try {
        setSsoPending(true);
        await loginWithSso();
      } catch (err) {
        console.warn("Auto SSO login was blocked or failed", err);
      } finally {
        if (active) setSsoPending(false);
      }
    };

    triggerAutoSso();
    return () => {
      active = false;
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
