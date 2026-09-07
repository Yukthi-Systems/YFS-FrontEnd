import { API_BASE_URL } from "@yfs/service";
import { slugify, formatCurrency } from "@yfs/utils";
import type { UserInfo } from "../../context/AuthContext";
import { getStorageQuota } from "../../utils/format";

export function SystemDashboard({
  user,
  token,
  exampleMessage,
  apiResponse,
  apiLoading,
  onTestApi,
}: {
  user: UserInfo | null;
  token: string | null;
  exampleMessage: string;
  apiResponse: string;
  apiLoading: boolean;
  onTestApi: () => void;
}) {
  const storage = getStorageQuota(user?.quota_allocated, user?.quota_utilized);
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 pb-12 flex flex-col gap-6 text-left max-[768px]:px-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-text-heading">Organization Details</h2>
        <p className="text-sm text-text-main">Secure workspace account details retrieved via single sign-on.</p>
      </div>

      <div className="bg-code-bg p-6 rounded-2xl border border-border-main">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-main font-medium uppercase tracking-wider">Organization Name</span>
            <span className="text-base font-semibold text-text-heading">{user?.organization_name || "N/A"}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-main font-medium uppercase tracking-wider">Workspace Domain</span>
            <span className="text-base font-semibold text-text-heading">{user?.domain_name || "N/A"}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-main font-medium uppercase tracking-wider">Storage Used</span>
            <span className="text-base font-semibold text-text-heading">
              {user?.quota_allocated === undefined
                ? "N/A"
                : `${storage.usedLabel} / ${storage.totalLabel}${storage.hasQuota ? ` (${Math.round(storage.percent)}%)` : ""}`}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-main font-medium uppercase tracking-wider">File Sharing Status</span>
            <span className="text-base font-semibold text-text-heading">{user?.enable_file_sharing ? "Enabled ✅" : "Disabled ❌"}</span>
          </div>
        </div>
      </div>

      <div className="bg-code-bg p-6 rounded-2xl border border-border-main">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-main font-medium uppercase tracking-wider">Name</span>
            <span className="text-base font-semibold text-text-heading">
              {[user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "N/A"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-main font-medium uppercase tracking-wider">Email</span>
            <span className="text-base font-semibold text-text-heading">{user?.email || "N/A"}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-main font-medium uppercase tracking-wider">Phone</span>
            <span className="text-base font-semibold text-text-heading">{user?.phone || "N/A"}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-main font-medium uppercase tracking-wider">2FA Methods</span>
            <span className="text-base font-semibold text-text-heading">
              {user?.two_factor_methods && user.two_factor_methods.length > 0 ? user.two_factor_methods.join(", ") : "None"}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-code-bg p-6 rounded-2xl border border-border-main">
        <h3 className="text-base font-bold text-text-heading mb-1.5">Backend API Verification</h3>
        <p className="text-sm text-text-main mb-4 leading-relaxed">
          Execute requests against the local backend server passing the current JWT token.
        </p>
        <button
          onClick={onTestApi}
          disabled={apiLoading}
          className="flex items-center justify-center w-fit py-2.5 px-5 bg-gradient-to-br from-accent to-purple-600 text-white font-semibold rounded-xl hover:shadow-md cursor-pointer transition-all"
        >
          {apiLoading ? "Verifying Session..." : "Verify API Session"}
        </button>

        {apiResponse && (
          <div className="mt-4">
            <span className="text-xs text-text-main font-medium uppercase tracking-wider">Response Data</span>
            <pre className="max-w-full overflow-x-auto text-[11px] font-mono leading-relaxed bg-bg-main p-3 rounded-lg border border-border-main whitespace-pre-wrap break-all mt-1">
              <code>{apiResponse}</code>
            </pre>
          </div>
        )}
      </div>

      <div className="bg-code-bg p-6 rounded-2xl border border-border-main">
        <h3 className="text-base font-bold text-text-heading mb-1.5">Active Authentication token</h3>
        <div className="max-w-full overflow-x-auto text-[11px] font-mono leading-relaxed bg-bg-main p-3 rounded-lg border border-border-main whitespace-pre-wrap break-all">
          <code>{token}</code>
        </div>
      </div>

      <div className="border-t border-border-main pt-4 flex flex-col gap-2">
        <p className="text-sm text-text-main">
          <strong>Local Utility check:</strong> slugified name:{" "}
          <code className="bg-code-bg px-1.5 py-0.5 rounded text-text-heading">{slugify(user?.username || "")}</code> | mock currency:{" "}
          <code className="bg-code-bg px-1.5 py-0.5 rounded text-text-heading">{formatCurrency(1999)}</code>
        </p>
        <p className="text-sm text-text-main">
          <strong>Local Shared Package (service fetch):</strong>{" "}
          <code className="bg-code-bg px-1.5 py-0.5 rounded text-text-heading">{exampleMessage}</code>
        </p>
        <p className="text-xs text-neutral-400">
          API Base URL Configured: <code>{API_BASE_URL || "(Not defined)"}</code>
        </p>
      </div>
    </div>
  );
}
