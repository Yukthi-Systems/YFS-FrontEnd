/*
 * Copyright (C) 2026 Yukthi Systems Private Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * version 3 along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2, Lock, X } from "lucide-react";
import type { ExternalShare, InternalSharePermissions } from "@yfs/service";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useToast } from "../../atoms/toast";
import { Checkbox } from "../common/Checkbox";
import { PermissionPicker, permsOf } from "../common/PermissionPicker";
import { PhoneListInput } from "../common/PhoneListInput";
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
  const [copied, setCopied] = useState(false);

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

  const url = `${window.location.origin}/share/${share.share_id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("Couldn't copy the link to your clipboard", "error");
    }
  };

  return (
    <ModalShell onClose={onClose} size="lg" padded={false}>
      <div className="shrink-0 flex items-start gap-3 px-5 pt-5">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-accent-bg border border-accent-border flex items-center justify-center">
          <Link2 className="w-4 h-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.95rem] font-semibold text-text-heading leading-snug m-0">Edit link</h3>
          <p className="text-[11px] text-text-main truncate mt-0.5">Public link settings</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 p-1.5 rounded-lg text-text-main hover:bg-code-bg hover:text-text-heading transition border-none bg-transparent cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-xl border border-border-main bg-code-bg/50 px-3 py-2">
          <span className="flex-1 min-w-0 text-[11px] text-text-heading font-mono truncate" title={url}>
            {url}
          </span>
          <button
            type="button"
            onClick={copy}
            title="Copy link"
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-main bg-bg-main text-[11px] font-semibold text-text-heading cursor-pointer transition hover:border-accent hover:text-accent"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className={SECTION_LABEL}>Permissions</span>
          <PermissionPicker value={perms} onChange={setPerms} />
        </div>

        <div className="flex flex-col gap-2">
          <span className={SECTION_LABEL}>Protection</span>
          <Checkbox
            checked={changePassword}
            onChange={(next) => {
              setChangePassword(next);
              setPassword("");
            }}
            label={
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-text-main" />
                {share.password_hash ? "Change or remove password" : "Set a password"}
              </span>
            }
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

          <div className="grid grid-cols-2 gap-2.5 max-[440px]:grid-cols-1">
            <Field label="OTP emails (optional)">
              <input
                value={otpEmails}
                onChange={(e) => setOtpEmails(e.target.value)}
                placeholder="name@company.com, …"
                className="dialog-input"
              />
            </Field>
            <Field label="OTP phone numbers (optional)">
              <PhoneListInput value={otpPhones} onChange={setOtpPhones} />
            </Field>
          </div>

          <Field label="Expires (optional)">
            <input
              type="date"
              min={todayDateInput()}
              max={maxDateInput()}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="dialog-input"
            />
          </Field>
          {expiryErr && <span className="text-[10px] text-red-500">{expiryErr}</span>}
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-end gap-3 px-5 py-3.5 border-t border-border-main">
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

const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-wider text-text-main";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-text-main">{label}</span>
      {children}
    </label>
  );
}
