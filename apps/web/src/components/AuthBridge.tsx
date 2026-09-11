import { useEffect } from "react";
import { bootAuth } from "../services/authStore";

// Runs the sign-in boot sequence (SSO cookie / cached-token validation) once on app
// start. Mounted once, only for the authenticated tree — the shared-link view skips
// it entirely (a link visitor isn't logged in).
export function AuthBridge() {
  useEffect(() => {
    const signal = { cancelled: false };
    bootAuth(signal);
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
