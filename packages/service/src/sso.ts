import { getApiUrl } from "./http";

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

        try {
          const loginUrl = getApiUrl("/auth/login");
          // Call local API with credentials to send the SSO Session ID cookie
          const response = await fetch(loginUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
          });

          if (!response.ok) {
            throw new Error(`SSO authentication handshake failed with status ${response.status}`);
          }

          const data = await response.json();
          const headers: Record<string, string> = {};
          response.headers.forEach((val, key) => {
            headers[key] = val;
          });

          resolve({ data, headers });
        } catch (err) {
          reject(err);
        }
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
