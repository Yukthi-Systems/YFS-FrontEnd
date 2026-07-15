import React, { createContext, useContext, useState, useEffect } from "react";
import { openSsoPopupAndAuthenticate, logout as apiLogout } from "@yfs/service";

export interface UserInfo {
  email: string;
  domain_name?: string;
  organization_id?: string;
  organization_name?: string;
  enable_file_sharing?: boolean;
  file_size_limit_mb?: number;
  enable_group_chat?: boolean;
  enable_direct_chat?: boolean;
  quota_allocated?: number;
  quota_utilized?: number;
  id?: number;
  username?: string;
}

interface AuthContextType {
  user: UserInfo | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  errorMsg: string | null;
  loginWithSso: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ssoUrl = (import.meta as any).env.VITE_SSO_URL || "https://sso.your-domain.tld";

  // Re-hydrate state from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("yfs_token");
      const savedUserJson = localStorage.getItem("yfs_user");

      if (savedToken && savedUserJson) {
        setToken(savedToken);
        setUser(JSON.parse(savedUserJson));
      }
    } catch (err) {
      console.error("Failed to restore auth session:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithSso = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data } = await openSsoPopupAndAuthenticate(ssoUrl);
      
      const userInfo = data.user_info;
      const normalizedUser = {
        ...userInfo,
        id: userInfo.id || 0,
        username: userInfo.username || userInfo.email.split("@")[0],
      };

      setToken(data.access_token);
      setUser(normalizedUser);

      localStorage.setItem("yfs_token", data.access_token);
      localStorage.setItem("yfs_user", JSON.stringify(normalizedUser));
    } catch (err: any) {
      console.error("SSO authentication failed:", err);
      const message = err.message || "SSO Authentication failed";
      setErrorMsg(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiLogout(ssoUrl);
    } catch (err) {
      console.error("Failed to call API logout endpoints:", err);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem("yfs_token");
      localStorage.removeItem("yfs_user");
      setIsLoading(false);
      
      // Redirect to login page with logout flag
      window.location.search = "logout=true";
    }
  };

  const clearError = () => setErrorMsg(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        errorMsg,
        loginWithSso,
        logout,
        clearError,
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
