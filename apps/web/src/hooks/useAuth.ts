import { useAtomValue } from "jotai";
import { userAtom, tokenAtom, userIdAtom, sessionExpiresAtAtom, isAuthLoadingAtom, authErrorMsgAtom } from "../atoms/auth";
import { loginWithSso, logout, clearError, refreshAccessToken } from "../services/authStore";

export type { UserInfo } from "../atoms/auth";

// Reads services/authStore.ts (a singleton, booted once by components/AuthBridge.tsx)
// and re-exports its actions.
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
