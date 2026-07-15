import { getApiUrl } from "./http";

export const logout = async (ssoUrl: string): Promise<void> => {
  try {
    const localLogoutUrl = getApiUrl("/auth/logout");
    await fetch(localLogoutUrl, {
      method: "DELETE",
      credentials: "include",
    });
  } catch (err) {
    console.error("Local API backend logout failed", err);
  }

  try {
    const ssoLogoutUrl = `${ssoUrl.replace(/\/$/, "")}/auth/logout`;
    await fetch(ssoLogoutUrl, {
      method: "DELETE",
      credentials: "include",
    });
  } catch (err) {
    console.error("SSO logout failed", err);
  }
};
