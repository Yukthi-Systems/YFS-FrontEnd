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
import { Check, Clock, Copy, FileText, Folder, KeyRound, Link2, Mail, Pencil, Share2, Trash2 } from "lucide-react";
import type { ExternalShare } from "@yfs/service";
import { formatDate } from "../../utils/format";
import { PERMISSION_FIELDS } from "../common/PermissionPicker";

const shareUrl = (shareId: string) => `${window.location.origin}/share/${shareId}`;
const isExpired = (iso: string | null) => !!iso && new Date(iso).getTime() < Date.now();

// "Shared by link" view — every external link I've created.
export function SharedLinksList({
  links,
  onRevoke,
  onEdit,
}: {
  links: ExternalShare[];
  onRevoke: (shareId: string) => Promise<void>;
  onEdit: (share: ExternalShare) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const copy = async (shareId: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(shareId));
      setCopiedId(shareId);
      setTimeout(() => setCopiedId((c) => (c === shareId ? null : c)), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  // Native share sheet where supported, else clipboard.
  const nativeShare = async (shareId: string) => {
    const url = shareUrl(shareId);
    if (navigator.share) {
      try {
        await navigator.share({ title: "YFS shared link", url });
      } catch {
        /* user dismissed the share sheet, or the OS declined it — nothing to do */
      }
    } else {
      copy(shareId);
    }
  };

  const revoke = async (shareId: string) => {
    setBusyId(shareId);
    try {
      await onRevoke(shareId);
    } finally {
      setBusyId(null);
    }
  };

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-text-main">
        <Link2 className="w-10 h-10 opacity-40" />
        <p className="text-sm">You haven't created any public links yet.</p>
        <p className="text-xs opacity-70">Use Share → Public links on a file or folder.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-text-heading m-0">Shared by link</h2>
        <span className="text-xs font-medium text-text-main bg-code-bg border border-border-main rounded-full px-2 py-0.5">
          {links.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {links.map((s) => {
          const otpCount = s.emails_for_otp.length + s.phones_for_otp.length;
          const expired = isExpired(s.expires_at);
          const isFolder = !!s.share_folder_target_id;
          const perms = PERMISSION_FIELDS.filter(({ key }) => s.permission_set[key]);

          return (
            <div
              key={s.share_id}
              role="button"
              tabIndex={0}
              onClick={() => onEdit(s)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEdit(s);
                }
              }}
              title="Edit this link"
              className="group bg-bg-main border border-border-main rounded-xl px-3.5 py-3 flex items-start gap-3 cursor-pointer transition hover:border-accent-border hover:bg-code-bg/40 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent-bg"
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  expired ? "bg-code-bg text-text-main" : "bg-accent-bg text-accent"
                }`}
              >
                {isFolder ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              </div>

              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text-heading truncate" title={shareUrl(s.share_id)}>
                    {shareUrl(s.share_id)}
                  </span>
                  {expired && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-md border border-red-500/30 bg-red-500/10 text-red-500 text-[10px] font-semibold">
                      Expired
                    </span>
                  )}
                </div>

                {perms.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {perms.map(({ key, label }) => (
                      <span
                        key={key}
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-code-bg text-text-main border border-border-main"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-main">
                  {s.password_hash && (
                    <span className="inline-flex items-center gap-1">
                      <KeyRound className="w-3 h-3" /> Password
                    </span>
                  )}
                  {otpCount > 0 && (
                    <span className="relative group/otp inline-flex items-center gap-1 cursor-default">
                      <Mail className="w-3 h-3" /> OTP to {otpCount}
                      <div className="hidden group-hover/otp:flex absolute left-0 top-full mt-1.5 z-20 flex-col gap-1 min-w-44 max-w-72 bg-bg-main border border-border-main rounded-lg shadow-lg p-2 text-text-heading">
                        {s.emails_for_otp.map((email) => (
                          <span key={`e-${email}`} className="truncate">
                            {email}
                          </span>
                        ))}
                        {s.phones_for_otp.map((phone) => (
                          <span key={`p-${phone}`} className="truncate">
                            {phone}
                          </span>
                        ))}
                      </div>
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 ${expired ? "text-red-500 font-medium" : ""}`}>
                    <Clock className="w-3 h-3" />
                    {s.expires_at ? `${expired ? "Expired" : "Expires"} ${formatDate(s.expires_at)}` : "No expiry"}
                  </span>
                  <span>Created {formatDate(s.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <RowAction onClick={() => nativeShare(s.share_id)} title="Share">
                  <Share2 className="w-4 h-4" />
                </RowAction>
                <RowAction onClick={() => copy(s.share_id)} title="Copy link">
                  {copiedId === s.share_id ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
                </RowAction>
                <RowAction onClick={() => onEdit(s)} title="Edit link">
                  <Pencil className="w-4 h-4" />
                </RowAction>
                <RowAction onClick={() => revoke(s.share_id)} disabled={busyId === s.share_id} title="Revoke link" danger>
                  <Trash2 className="w-4 h-4" />
                </RowAction>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RowAction({
  onClick,
  title,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed ${
        danger ? "text-red-500 hover:bg-red-500/10" : "text-text-main hover:bg-code-bg hover:text-text-heading"
      }`}
    >
      {children}
    </button>
  );
}

