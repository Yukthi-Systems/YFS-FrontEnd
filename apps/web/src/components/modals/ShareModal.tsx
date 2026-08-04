import { useState } from "react";
import { Copy, Info, Trash2, UserPlus, X } from "lucide-react";
import type { FileItem, ShareCollaborator, ShareSettings } from "../../types/file";
import { generateShareToken } from "../../utils/shareToken";
import { ModalShell } from "./ModalShell";

export function ShareModal({
  item,
  onClose,
  onSave,
  onRevoke,
}: {
  item: FileItem;
  onClose: () => void;
  onSave: (settings: ShareSettings) => void;
  onRevoke: () => void;
}) {
  const existing = item.share;
  const [collaborators, setCollaborators] = useState<ShareCollaborator[]>(existing?.collaborators ?? []);
  const [newEmail, setNewEmail] = useState("");
  const [newPermission, setNewPermission] = useState<"view" | "edit">("view");
  const [visibility, setVisibility] = useState<"restricted" | "anyone">(existing?.visibility ?? "restricted");
  const [linkPermission, setLinkPermission] = useState<"view" | "edit">(existing?.linkPermission ?? "view");
  const [passwordEnabled, setPasswordEnabled] = useState(!!existing?.password);
  const [password, setPassword] = useState(existing?.password ?? "");
  const [otpRequired, setOtpRequired] = useState(!!existing?.otpRequired);
  const [expiresAt, setExpiresAt] = useState(existing?.expiresAt ? existing.expiresAt.slice(0, 10) : "");
  const [copied, setCopied] = useState(false);

  const token = existing?.token ?? generateShareToken();
  const shareUrl = `${window.location.origin}/share/${token}`;

  const addCollaborator = () => {
    const email = newEmail.trim();
    if (!email) return;
    setCollaborators((prev) => [...prev.filter((c) => c.email !== email), { email, permission: newPermission }]);
    setNewEmail("");
  };

  const removeCollaborator = (email: string) => {
    setCollaborators((prev) => prev.filter((c) => c.email !== email));
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSave({
      token,
      visibility,
      linkPermission,
      password: passwordEnabled && password.trim() ? password.trim() : undefined,
      otpRequired,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      collaborators,
    });
  };

  return (
    <ModalShell onClose={onClose}>
      <h3 className="modal-title">Share "{item.name}"</h3>

      <div className="flex gap-2.5 text-left bg-accent-bg border border-accent-border text-text-heading p-3 rounded-xl text-[11px] leading-normal mb-4">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" />
        <span>
          Demo mode: password and OTP checks here only run in this browser's UI. There is no backend to verify
          them, so don't rely on this for anything sensitive.
        </span>
      </div>

      <div className="flex flex-col gap-4 mb-5">
        <div>
          <label className="data-label mb-1.5 block">People with access</label>
          <div className="flex flex-col gap-1.5 mb-2 max-h-32 overflow-y-auto">
            {collaborators.length === 0 && <div className="text-xs text-text-main">No one added yet.</div>}
            {collaborators.map((c) => (
              <div key={c.email} className="flex items-center justify-between gap-2 bg-code-bg rounded-lg px-2.5 py-1.5">
                <span className="text-xs text-text-heading truncate">{c.email}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-text-main">{c.permission === "edit" ? "Editor" : "Viewer"}</span>
                  <button onClick={() => removeCollaborator(c.email)} className="border-none bg-transparent p-1 rounded-full text-text-main hover:bg-red-500/10 hover:text-red-500 cursor-pointer transition">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Add people by email"
              className="dialog-input flex-1"
              onKeyDown={(e) => e.key === "Enter" && addCollaborator()}
            />
            <select value={newPermission} onChange={(e) => setNewPermission(e.target.value as "view" | "edit")} className="dialog-input w-24">
              <option value="view">Viewer</option>
              <option value="edit">Editor</option>
            </select>
            <button onClick={addCollaborator} className="btn-outline px-3" style={{ width: "auto" }}>
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div>
          <label className="data-label mb-1.5 block">General access</label>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs text-text-heading cursor-pointer">
              <input type="radio" checked={visibility === "restricted"} onChange={() => setVisibility("restricted")} />
              Restricted — only people added above
            </label>
            <label className="flex items-center gap-2 text-xs text-text-heading cursor-pointer">
              <input type="radio" checked={visibility === "anyone"} onChange={() => setVisibility("anyone")} />
              Anyone with the link
            </label>
          </div>
          {visibility === "anyone" && (
            <select
              value={linkPermission}
              onChange={(e) => setLinkPermission(e.target.value as "view" | "edit")}
              className="dialog-input mt-2 w-full"
            >
              <option value="view">Viewer</option>
              <option value="edit">Editor</option>
            </select>
          )}
        </div>

        <div className="flex flex-col gap-2.5 border-t border-border-main pt-3">
          <label className="flex items-center justify-between text-xs text-text-heading cursor-pointer">
            <span>Require password</span>
            <input type="checkbox" checked={passwordEnabled} onChange={(e) => setPasswordEnabled(e.target.checked)} />
          </label>
          {passwordEnabled && (
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set a link password"
              className="dialog-input"
            />
          )}
          <label className="flex items-center justify-between text-xs text-text-heading cursor-pointer">
            <span>Require OTP verification</span>
            <input type="checkbox" checked={otpRequired} onChange={(e) => setOtpRequired(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between text-xs text-text-heading">
            <span>Link expires</span>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="dialog-input w-auto" />
          </label>
        </div>

        <div>
          <label className="data-label mb-1.5 block">Shareable link</label>
          <div className="flex gap-1.5">
            <input type="text" readOnly value={shareUrl} className="dialog-input flex-1 text-[11px]" />
            <button onClick={handleCopyLink} className="btn-outline px-3 shrink-0" style={{ width: "auto" }}>
              <Copy className="w-3.5 h-3.5" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      <div className="modal-actions">
        {existing && (
          <button
            onClick={onRevoke}
            className="flex items-center gap-1.5 text-red-500 bg-transparent border-none text-xs font-semibold cursor-pointer hover:bg-red-500/10 rounded-lg px-3 py-2 mr-auto"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove Link
          </button>
        )}
        <button onClick={onClose} className="btn-outline">
          Cancel
        </button>
        <button onClick={handleSave} className="btn-primary" style={{ width: "auto" }}>
          Save
        </button>
      </div>
    </ModalShell>
  );
}
