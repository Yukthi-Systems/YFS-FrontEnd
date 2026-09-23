import { useState } from "react";
import { Building2, Check, Globe, HardDrive, Loader2, Phone, RefreshCcw, RotateCw, ShieldCheck, X } from "lucide-react";
import type { UserInfo } from "../../atoms/auth";
import { AVATAR_COLORS, useUserSettings } from "../../hooks/useUserSettings";
import { useRefreshUserQuota } from "../../hooks/useUserQuota";
import { capitalize } from "@yfs/utils";
import { Avatar } from "../common/Avatar";
import { ConfirmModal } from "./ConfirmModal";
import { ModalShell } from "./ModalShell";

const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-wider text-text-main";

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border-main last:border-b-0">
      <span className="text-text-main shrink-0">{icon}</span>
      <span className="text-xs text-text-main shrink-0">{label}</span>
      <span className="ml-auto text-xs text-text-heading font-medium text-right break-words min-w-0">{value}</span>
    </div>
  );
}

function StatusPill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${
        on
          ? "bg-accent-bg text-accent border-accent-border"
          : "bg-code-bg text-text-main border-border-main"
      }`}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}

export function ProfileModal({
  user,
  storagePercentage,
  storageUsedLabel,
  storageTotalLabel,
  storageFileCount,
  onClose,
}: {
  user: UserInfo | null;
  storagePercentage: number;
  storageUsedLabel: string;
  storageTotalLabel: string;
  storageFileCount?: number;
  onClose: () => void;
}) {
  // The name is read-only here — it comes from SSO (or a display_name set elsewhere,
  // which is what other people see, matching UserMenu). Only the avatar colour is
  // this user's to change.
  const { publicProfile, savePublicProfile } = useUserSettings();
  const { refreshQuota, refreshing } = useRefreshUserQuota();
  const [confirmRecalc, setConfirmRecalc] = useState(false);

  const displayName = publicProfile.display_name?.trim() || capitalize(user?.username || "Guest User");
  const twoFa = user?.two_factor_methods?.length ? user.two_factor_methods.join(", ") : null;
  const pct = Math.min(100, Math.max(0, storagePercentage));
  const nearFull = pct >= 90;

  return (
    <ModalShell onClose={onClose} size="lg" padded={false}>
      <div className="shrink-0 flex items-start gap-3 px-5 pt-5">
        <Avatar
          name={publicProfile.display_name || user?.username}
          email={user?.email}
          color={publicProfile.avatar_color}
          className="w-11 h-11 min-w-11 text-sm"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.95rem] font-semibold text-text-heading leading-snug m-0 truncate">{displayName}</h3>
          <p className="text-[11px] text-text-main truncate mt-0.5">{user?.email}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 p-1.5 rounded-lg text-text-main hover:bg-code-bg hover:text-text-heading transition border-none bg-transparent cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className={SECTION_LABEL}>Avatar colour</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => savePublicProfile({ avatar_color: undefined })}
              title="Default"
              className={`rounded-full p-0.5 border-2 transition cursor-pointer bg-transparent ${
                publicProfile.avatar_color ? "border-transparent hover:border-border-main" : "border-accent"
              }`}
            >
              <Avatar name={publicProfile.display_name || user?.username} email={user?.email} className="w-6 h-6 text-[9px]" />
            </button>
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => savePublicProfile({ avatar_color: c })}
                title={c}
                aria-label={`Avatar colour ${c}`}
                className={`w-7 h-7 rounded-full border-2 transition cursor-pointer flex items-center justify-center ${
                  publicProfile.avatar_color === c ? "border-accent" : "border-transparent hover:border-border-main"
                }`}
                style={{ background: c }}
              >
                {publicProfile.avatar_color === c && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className={SECTION_LABEL}>Storage</span>
            <button
              onClick={() => setConfirmRecalc(true)}
              disabled={refreshing}
              title="Recalculate usage by re-scanning every file you own. This can take a moment."
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border-main bg-bg-main text-[11px] font-semibold text-text-heading cursor-pointer transition hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
              {refreshing ? "Recalculating…" : "Recalculate"}
            </button>
          </div>
          <div className="rounded-xl border border-border-main bg-code-bg/50 p-3 flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-text-heading font-semibold">
                {storageUsedLabel} <span className="text-text-main font-normal">of {storageTotalLabel}</span>
              </span>
              <span className={`text-xs font-semibold ${nearFull ? "text-red-500" : "text-text-main"}`}>
                {Math.round(pct)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-border-main rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${nearFull ? "bg-red-500" : "bg-accent"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {storageFileCount !== undefined && (
              <span className="text-[11px] text-text-main">
                {storageFileCount.toLocaleString()} file{storageFileCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className={SECTION_LABEL}>Account</span>
          <div className="rounded-xl border border-border-main overflow-hidden">
            {user?.organization_name && (
              <Row icon={<Building2 className="w-3.5 h-3.5" />} label="Organization" value={user.organization_name} />
            )}
            {user?.domain_name && <Row icon={<Globe className="w-3.5 h-3.5" />} label="Domain" value={user.domain_name} />}
            {user?.phone && <Row icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={user.phone} />}
            <Row
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              label="Two-factor"
              value={twoFa ?? <StatusPill on={false} onLabel="On" offLabel="Off" />}
            />
            <Row
              icon={<RefreshCcw className="w-3.5 h-3.5" />}
              label="File versioning"
              value={<StatusPill on={!!user?.is_file_versioning_enabled} onLabel="Enabled" offLabel="Disabled" />}
            />
            <Row
              icon={<HardDrive className="w-3.5 h-3.5" />}
              label="Sharing"
              value={<StatusPill on={!!user?.is_sharing_enabled} onLabel="Enabled" offLabel="Disabled" />}
            />
            {user?.user_id && (
              <Row
                icon={<span className="text-[10px] font-mono font-bold">ID</span>}
                label="User ID"
                value={<span className="font-mono text-[10px] break-all">{user.user_id}</span>}
              />
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-end px-5 py-3.5 border-t border-border-main">
        <button onClick={onClose} className="btn-primary" style={{ width: "auto" }}>
          Done
        </button>
      </div>

      {confirmRecalc && (
        <ConfirmModal
          title="Recalculate storage usage"
          description="This re-scans every file you own, so it may take a moment. Recalculate now?"
          confirmLabel="Recalculate"
          destructive={false}
          onCancel={() => setConfirmRecalc(false)}
          onConfirm={() => {
            setConfirmRecalc(false);
            refreshQuota().catch(() => {});
          }}
        />
      )}
    </ModalShell>
  );
}
