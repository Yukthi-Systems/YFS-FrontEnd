

export interface SsoAuthResponse {
  data: {
    access_token: string;
    user_info: {
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
    };
  };
  headers: Record<string, string>;
}

export const openSsoPopupAndAuthenticate = (ssoUrl: string): Promise<SsoAuthResponse> => {
  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const origin = window.location.origin;
    const popupUrl = `${ssoUrl}/login?mode=popup&app=chat&origin=${encodeURIComponent(origin)}`;

    const popup = window.open(
      popupUrl,
      "SSO Login",
      `width=${width},height=${height},top=${top},left=${left}`
    );

    if (!popup) {
      reject(new Error("Popup blocked by browser. Please allow popups for this site."));
      return;
    }

    const messageListener = async (event: MessageEvent) => {
      // Validate sender origin
      if (event.origin !== ssoUrl) {
        return;
      }

      if (event.data?.type === "SSO_AUTH_SUCCESS") {
        cleanup();

        // Bypass calling the /auth/login endpoint and resolve directly with mock authentication details
        const data = {
          access_token: "mock-sso-access-token-123456789",
          user_info: {
            email: "alen@example.com",
            domain_name: "example.com",
            organization_id: "org-yukthi",
            organization_name: "Yukthi Systems",
            enable_file_sharing: true,
            file_size_limit_mb: 100,
            enable_group_chat: true,
            enable_direct_chat: true,
            quota_allocated: 2000,
            quota_utilized: 150,
            id: 42,
            username: "alen",
          },
        };
        const headers: Record<string, string> = {};
        resolve({ data, headers });
      } else if (event.data?.type === "SSO_AUTH_FAILED") {
        cleanup();
        reject(new Error(event.data?.message || "SSO Authentication failed"));
      }
    };

    const cleanup = () => {
      window.removeEventListener("message", messageListener);
      clearInterval(checkClosed);
      popup.close();
    };

    window.addEventListener("message", messageListener);

    // Watch for popup close
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        window.removeEventListener("message", messageListener);
        clearInterval(checkClosed);
        reject(new Error("SSO login window closed."));
      }
    }, 1000);
  });
};

export const openSsoLogoutPopup = (ssoUrl: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 450;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const origin = window.location.origin;
    const popupUrl = `${ssoUrl.replace(/\/$/, "")}/logout?mode=popup&origin=${encodeURIComponent(origin)}`;

    const popup = window.open(
      popupUrl,
      "SSO Logout",
      `width=${width},height=${height},top=${top},left=${left}`
    );

    if (!popup) {
      reject(new Error("Popup blocked by browser. Please allow popups for this site."));
      return;
    }

    const messageListener = (event: MessageEvent) => {
      // Validate sender origin
      if (event.origin !== ssoUrl.replace(/\/$/, "")) {
        return;
      }

      if (event.data?.type === "SSO_LOGOUT") {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      window.removeEventListener("message", messageListener);
      clearInterval(checkClosed);
      popup.close();
    };

    window.addEventListener("message", messageListener);

    // Watch for popup close
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        window.removeEventListener("message", messageListener);
        clearInterval(checkClosed);
        resolve(); // Resolve anyway if they closed the window manually
      }
    }, 1000);
  });
};
