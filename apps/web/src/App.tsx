import { useEffect, useState } from "react";
import { capitalize, slugify, formatCurrency } from "@yfs/utils";
import { getJson, API_BASE_URL, getApiJson } from "@yfs/service";
import { useAuth } from "./context/AuthContext";
import "./App.css";

interface Example {
  message: string;
}

function App() {
  const {
    user,
    token,
    isAuthenticated,
    isLoading: authLoading,
    errorMsg,
    loginWithSso,
    logout,
    clearError,
  } = useAuth();

  const [exampleMessage, setExampleMessage] = useState<string>("loading...");
  const [apiResponse, setApiResponse] = useState<string>("");
  const [apiLoading, setApiLoading] = useState<boolean>(false);
  const [ssoPending, setSsoPending] = useState<boolean>(false);

  // Check url parameters to see if user recently logged out
  const searchParams = new URLSearchParams(window.location.search);
  const isLogoutParam = searchParams.get("logout") === "true";

  // Auto-trigger SSO on mount if not authenticated and not explicitly logged out
  useEffect(() => {
    if (isAuthenticated || authLoading || isLogoutParam) {
      return;
    }

    let active = true;

    const triggerAutoSso = async () => {
      // Small delay for smooth transition
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (!active) return;

      try {
        setSsoPending(true);
        await loginWithSso();
      } catch (err) {
        console.warn("Auto SSO login was blocked or failed", err);
      } finally {
        if (active) {
          setSsoPending(false);
        }
      }
    };

    triggerAutoSso();

    return () => {
      active = false;
    };
  }, [isAuthenticated, authLoading, isLogoutParam]);

  // Load example local asset data
  useEffect(() => {
    getJson<Example>("/example.json")
      .then((data) => setExampleMessage(data.message))
      .catch((err) => setExampleMessage(`error: ${err.message}`));
  }, []);

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

  const testAuthenticatedApi = async () => {
    if (!token) return;
    setApiLoading(true);
    setApiResponse("");
    try {
      // Call local backend endpoint using the JWT token
      const data = await getApiJson<any>("/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setApiResponse(`Success: ${JSON.stringify(data)}`);
    } catch (err: any) {
      setApiResponse(`Error: ${err.message || "Failed to query backend API"}`);
    } finally {
      setApiLoading(false);
    }
  };

  // 1. Core global loading spinner
  if (authLoading) {
    return (
      <div className="app-container">
        <div className="auth-card">
          <div className="spinner"></div>
          <p style={{ marginTop: "1rem" }}>Restoring secure session...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated state (Login Card)
  if (!isAuthenticated) {
    return (
      <div className="app-container">
        <div className="auth-card">
          <div className="logo-container">🛡️</div>
          <h1 className="auth-title">Yukthi Workspace</h1>
          <p className="auth-subtitle">
            Access your secure organization workspace and tools using Single Sign-On (SSO).
          </p>

          {errorMsg ? (
            <div className="error-banner">
              <div>
                <strong>Authentication Notice</strong>
                <p style={{ margin: "4px 0 0 0" }}>{errorMsg}</p>
              </div>
            </div>
          ) : ssoPending ? (
            <div className="info-banner">
              <div>
                <strong>SSO Authentication Active</strong>
                <p style={{ margin: "4px 0 0 0" }}>
                  Please complete the login verification in the opened SSO window.
                </p>
              </div>
            </div>
          ) : null}

          {ssoPending && <div className="spinner"></div>}

          <button
            onClick={handleManualLogin}
            disabled={ssoPending}
            className="btn-primary"
            style={{ marginTop: "1rem" }}
          >
            {ssoPending ? "Awaiting SSO Verification..." : "Continue with Yukthi SSO"}
          </button>

          {isLogoutParam && (
            <p style={{ fontSize: "0.85rem", color: "var(--text)", marginTop: "1.5rem" }}>
              You have been logged out successfully.
            </p>
          )}
        </div>
      </div>
    );
  }

  // 3. Authenticated state (Dashboard)
  const userInitials = user?.username
    ? user.username.substring(0, 2).toUpperCase()
    : user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "US";

  return (
    <div className="app-container">
      <div className="dashboard-layout">
        <div className="dashboard-header">
          <div className="user-profile">
            <div className="avatar">{userInitials}</div>
            <div className="user-meta">
              <h2>{capitalize(user?.username || "Guest User")}</h2>
              <p>{user?.email}</p>
            </div>
          </div>
          <button onClick={logout} className="btn-secondary" style={{ width: "auto" }}>
            Logout
          </button>
        </div>

        {/* User Workspace Info */}
        <div className="data-section">
          <h3 className="data-title">Organization Details</h3>
          <div className="data-grid">
            <div className="data-item">
              <span className="data-label">Organization Name</span>
              <span className="data-value">{user?.organization_name || "N/A"}</span>
            </div>
            <div className="data-item">
              <span className="data-label">Workspace Domain</span>
              <span className="data-value">{user?.domain_name || "N/A"}</span>
            </div>
            <div className="data-item">
              <span className="data-label">Quota Allocation</span>
              <span className="data-value">
                {user?.quota_utilized !== undefined && user?.quota_allocated !== undefined
                  ? `${user.quota_utilized} MB / ${user.quota_allocated} MB`
                  : "N/A"}
              </span>
            </div>
            <div className="data-item">
              <span className="data-label">File Sharing</span>
              <span className="data-value">
                {user?.enable_file_sharing ? "Enabled ✅" : "Disabled ❌"}
              </span>
            </div>
          </div>
        </div>

        {/* API Verification section */}
        <div className="data-section">
          <h3 className="data-title">Backend API Verification</h3>
          <p style={{ fontSize: "0.9rem", marginBottom: "1rem", color: "var(--text)" }}>
            Execute a request against the local backend endpoint passing the SSO JWT token to
            validate API authorization.
          </p>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
            <button
              onClick={testAuthenticatedApi}
              disabled={apiLoading}
              className="btn-primary"
              style={{ width: "auto" }}
            >
              {apiLoading ? "Verifying..." : "Verify API Session"}
            </button>
          </div>
          {apiResponse && (
            <div style={{ marginTop: "1rem" }}>
              <span className="data-label">API Response</span>
              <div className="token-container" style={{ background: "var(--bg)", marginTop: "4px" }}>
                <code>{apiResponse}</code>
              </div>
            </div>
          )}
        </div>

        {/* Token Details */}
        <div className="data-section">
          <h3 className="data-title">Active Security Token</h3>
          <div className="token-container">
            <code>{token}</code>
          </div>
        </div>

        {/* Local Assets Verification */}
        <div style={{ marginTop: "2rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
          <p style={{ color: "var(--text)", fontSize: "0.85rem" }}>
            <strong>Local Utility Check:</strong> slugified name: <code>{slugify(user?.username || "")}</code> | mock currency: <code>{formatCurrency(1999)}</code>
          </p>
          <p style={{ color: "var(--text)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            <strong>Local Shared Package (service fetch):</strong> {exampleMessage}
          </p>
          <p style={{ color: "#888", fontSize: "0.8rem", marginTop: "1rem" }}>
            API Base URL Configured: <code>{API_BASE_URL || "(Not defined)"}</code>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
