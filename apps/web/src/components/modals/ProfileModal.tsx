import { useState } from "react";
import { Building2, Check, Globe, HardDrive, Pencil, Phone, RefreshCcw, ShieldCheck, X } from "lucide-react";
import type { UserInfo } from "../../context/AuthContext";
import { AVATAR_COLORS, useUserSettings } from "../../context/UserSettingsContext";
import { capitalize } from "@yfs/utils";
import { ModalShell } from "./ModalShell";

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border-main last:border-b-0">
      <span className="text-text-main mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-text-main font-semibold">{label}</div>
        <div className="text-[0.85rem] text-text-heading font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

export function ProfileModal({
  user,
  storagePercentage,
  storageUsedLabel,
  storageTotalLabel,
  onClose,
}: {
  user: UserInfo | null;
  storagePercentage: number;
  storageUsedLabel: string;
  storageTotalLabel: string;
  onClose: () => void;
}) {
  const { publicProfile, savePublicProfile, savingProfile } = useUserSettings();

  const ssoName = capitalize(user?.username || "Guest User");
  const displayName = publicProfile.display_name?.trim() || ssoName;
  const initials = (publicProfile.display_name || user?.username || user?.email || "US")
    .substring(0, 2)
    .toUpperCase();
  const avatarStyle = publicProfile.avatar_color ? { background: publicProfile.avatar_color } : undefined;
  const twoFa = user?.two_factor_methods?.length ? user.two_factor_methods.join(", ") : "Off";

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(publicProfile.display_name ?? "");
  const [colorDraft, setColorDraft] = useState<string | undefined>(publicProfile.avatar_color);

  const startEdit = () => {
    setNameDraft(publicProfile.display_name ?? "");
    setColorDraft(publicProfile.avatar_color);
    setEditing(true);
  };
  const saveEdit = () => {
    savePublicProfile({ display_name: nameDraft.trim() || undefined, avatar_color: colorDraft });
    setEditing(false);
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <span
          className="w-11 h-11 rounded-full bg-gradient-to-tr from-accent to-indigo-500 text-white flex items-center justify-center font-bold text-sm shrink-0"
          style={editing && colorDraft ? { background: colorDraft } : avatarStyle}
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder={ssoName}
              maxLength={60}
              className="dialog-input w-full text-sm"
            />
          ) : (
            <div className="text-sm font-semibold text-text-heading truncate">{displayName}</div>
          )}
          <div className="text-xs text-text-main truncate">{user?.email}</div>
        </div>
        {editing ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={saveEdit}
              disabled={savingProfile}
              className="p-1.5 rounded-lg text-accent hover:bg-accent-bg transition border-none bg-transparent cursor-pointer disabled:opacity-50"
              title="Save"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="p-1.5 rounded-lg text-text-main hover:bg-code-bg transition border-none bg-transparent cursor-pointer"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="p-1.5 rounded-lg text-text-main hover:bg-code-bg hover:text-text-heading transition border-none bg-transparent cursor-pointer shrink-0"
            title="Edit profile"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>

      {editing && (
        <div className="mb-4 -mt-1">
          <div className="text-[10px] uppercase tracking-wide text-text-main font-semibold mb-1.5">Avatar colour</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setColorDraft(undefined)}
              className={`w-6 h-6 rounded-full bg-gradient-to-tr from-accent to-indigo-500 border-2 transition ${
                colorDraft ? "border-transparent" : "border-text-heading"
              }`}
              title="Default"
            />
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColorDraft(c)}
                style={{ background: c }}
                className={`w-6 h-6 rounded-full border-2 transition ${
                  colorDraft === c ? "border-text-heading" : "border-transparent"
                }`}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col">
        {user?.organization_name && (
          <Row icon={<Building2 className="w-4 h-4" />} label="Organization" value={user.organization_name} />
        )}
        {user?.domain_name && <Row icon={<Globe className="w-4 h-4" />} label="Domain" value={user.domain_name} />}
        {user?.phone && <Row icon={<Phone className="w-4 h-4" />} label="Phone" value={user.phone} />}
        <Row icon={<ShieldCheck className="w-4 h-4" />} label="Two-factor" value={twoFa} />
        <Row
          icon={<RefreshCcw className="w-4 h-4" />}
          label="File versioning"
          value={user?.is_file_versioning_enabled ? "Enabled" : "Disabled"}
        />
        <Row
          icon={<Check className="w-4 h-4" />}
          label="Sharing"
          value={user?.is_sharing_enabled ? "Enabled" : "Disabled"}
        />
        <Row
          icon={<HardDrive className="w-4 h-4" />}
          label="Storage"
          value={
            <span>
              {storageUsedLabel} of {storageTotalLabel}{" "}
              <span className="text-text-main">({Math.round(storagePercentage)}%)</span>
            </span>
          }
        />
        {user?.user_id && (
          <Row
            icon={<span className="text-[10px] font-mono font-bold">ID</span>}
            label="User ID"
            value={<span className="font-mono text-[10px] break-all">{user.user_id}</span>}
          />
        )}
      </div>

      <div className="modal-actions mt-4">
        <button onClick={onClose} className="btn-primary" style={{ width: "auto" }}>
          Done
        </button>
      </div>
    </ModalShell>
  );
}
