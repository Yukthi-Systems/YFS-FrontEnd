import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import type { ExternalShare, InternalSharePermissions } from "@yfs/service";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useToast } from "../../atoms/toast";
import { Checkbox } from "../common/Checkbox";
import { PermissionPicker, permsOf } from "../common/PermissionPicker";
import { ModalShell } from "./ModalShell";

// Local calendar date an ISO instant falls on (not a raw UTC slice) — must agree with toExpiresIso below.
const toDateInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const toExpiresIso = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
};
const todayDateInput = () => toDateInput(new Date().toISOString());
// Links can't be set to expire more than 3 months out.
const MAX_EXPIRY_MONTHS = 3;
const maxDateInput = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + MAX_EXPIRY_MONTHS);
  return toDateInput(d.toISOString());
};
const isPastDate = (dateStr: string) => !!dateStr && dateStr < todayDateInput();
const isTooFarFuture = (dateStr: string) => !!dateStr && dateStr > maxDateInput();
const expiryError = (dateStr: string): string | null => {
  if (isPastDate(dateStr)) return "Expiry date can't be in the past.";
  if (isTooFarFuture(dateStr)) return `Expiry can't be more than ${MAX_EXPIRY_MONTHS} months out.`;
  return null;
};
const splitList = (raw: string) => raw.split(",").map((s) => s.trim()).filter(Boolean);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function EditShareLinkModal({ share, onClose }: { share: ExternalShare; onClose: () => void }) {
  const { updateSharedLink } = useFileSystem();
  const { showToast } = useToast();

  const [perms, setPerms] = useState<InternalSharePermissions>(permsOf(share.permission_set));
  const [otpEmails, setOtpEmails] = useState(share.emails_for_otp.join(", "));
  const [otpPhones, setOtpPhones] = useState(share.phones_for_otp.join(", "));
  const [expiresAt, setExpiresAt] = useState(toDateInput(share.expires_at));
  const [changePassword, setChangePassword] = useState(false);
  const [password, setPassword] = useState("");

  const expiryErr = expiryError(expiresAt);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateSharedLink(share.share_id, {
        permissions: perms,
        shareInfo: share.share_info,
        updatePassword: changePassword,
        rawPassword: changePassword ? password.trim() || null : null,
        emailsForOtp: splitList(otpEmails),
        phonesForOtp: splitList(otpPhones),
        expiresAt: toExpiresIso(expiresAt),
      }),
    onSuccess: () => {
      showToast("Link updated", "success");
      onClose();
    },
    onError: (err) => showToast(errMsg(err), "error"),
  });

  const saving = saveMutation.isPending;

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="modal-title mb-0 truncate">Edit link</h3>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-lg text-text-main hover:bg-code-bg hover:text-text-heading transition border-none bg-transparent cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-border-main bg-code-bg/50 px-3 py-2">
          <span className="text-[11px] text-text-heading font-mono break-all">
            {window.location.origin}/share/{share.share_id}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-main">Permissions</span>
          <PermissionPicker value={perms} onChange={setPerms} />
        </div>

        <div className="flex flex-col gap-2">
          <Checkbox
            checked={changePassword}
            onChange={(next) => {
              setChangePassword(next);
              setPassword("");
            }}
            label={share.password_hash ? "Change or remove password" : "Set a password"}
          />
          {changePassword && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (leave blank to remove)"
              className="dialog-input"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-text-main">OTP emails (optional)</span>
            <input
              value={otpEmails}
              onChange={(e) => setOtpEmails(e.target.value)}
              placeholder="name@company.com, …"
              className="dialog-input"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-text-main">OTP phone numbers (optional)</span>
            <input
              value={otpPhones}
              onChange={(e) => setOtpPhones(e.target.value)}
              placeholder="+1 555 0100, …"
              className="dialog-input"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-text-main">Expires (optional)</span>
          <input
            type="date"
            min={todayDateInput()}
            max={maxDateInput()}
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="dialog-input"
          />
          {expiryErr && <span className="text-[10px] text-red-500">{expiryErr}</span>}
        </label>
      </div>

      <div className="modal-actions mt-5">
        <button onClick={onClose} className="btn-outline">
          Cancel
        </button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saving || !!expiryErr}
          className="btn-primary flex items-center justify-center gap-1.5"
          style={{ width: "auto" }}
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </ModalShell>
  );
}
