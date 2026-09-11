import { useState } from "react";
import { Check, Clock, Copy, FileText, Folder, KeyRound, Link2, Mail, Share2, Trash2 } from "lucide-react";
import type { ExternalShare, InternalSharePermissions } from "@yfs/service";
import { formatDate } from "../../utils/format";

const shareUrl = (shareId: string) => `${window.location.origin}/share/${shareId}`;
const isExpired = (iso: string | null) => !!iso && new Date(iso).getTime() < Date.now();

const PERMS: { key: keyof InternalSharePermissions; label: string }[] = [
  { key: "can_preview", label: "Preview" },
  { key: "can_download", label: "Download" },
  { key: "can_create", label: "Create" },
  { key: "can_update", label: "Edit" },
  { key: "can_delete", label: "Delete" },
];

// "Shared by link" view — every external link I've created.
export function SharedLinksList({
  links,
  onRevoke,
  onOpenFolder,
}: {
  links: ExternalShare[];
  onRevoke: (shareId: string) => Promise<void>;
  // Folder-target links only — jumps to that folder in My Drive.
  onOpenFolder?: (folderId: string) => void;
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

  // The OS/browser-native share sheet (same one Windows/Android/mobile Safari show
  // for any app's "Share" button) — not every browser supports it (mainly desktop
  // Chrome/Firefox on non-Windows don't), so fall back to the clipboard copy above.
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
        <h2 className="text-lg font-semibold text-text-heading">Shared by link</h2>
        <span className="text-xs font-medium text-text-main bg-code-bg border border-border-main rounded-full px-2 py-0.5">
          {links.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {links.map((s) => {
          const otpCount = s.emails_for_otp.length + s.phones_for_otp.length;
          const expired = isExpired(s.expires_at);
          const isFolder = !!s.share_folder_target_id;

          return (
            <div
              key={s.share_id}
              className="group bg-bg-main border border-border-main rounded-xl px-3.5 py-3 flex items-start gap-3 transition hover:border-accent-border hover:shadow-sm"
            >
              {isFolder && onOpenFolder ? (
                <button
                  onClick={() => onOpenFolder(s.share_folder_target_id!)}
                  title="Open in My Drive"
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-accent-bg text-accent cursor-pointer hover:brightness-110 transition"
                >
                  <Folder className="w-4 h-4" />
                </button>
              ) : (
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isFolder ? "bg-accent-bg text-accent" : "bg-code-bg text-text-main"
                  }`}
                >
                  {isFolder ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </div>
              )}

              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-mono text-text-heading">
                  <span className="truncate" title={shareUrl(s.share_id)}>
                    {shareUrl(s.share_id)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {PERMS.filter(({ key }) => s.permission_set[key]).map(({ key, label }) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-accent-bg text-accent border border-accent-border"
                    >
                      <Check className="w-2.5 h-2.5" />
                      {label}
                    </span>
                  ))}
                </div>

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

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => nativeShare(s.share_id)}
                  title="Share"
                  className="p-1.5 rounded-lg text-text-main hover:bg-code-bg hover:text-text-heading cursor-pointer transition"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => copy(s.share_id)}
                  title="Copy link"
                  className="p-1.5 rounded-lg text-text-main hover:bg-code-bg hover:text-text-heading cursor-pointer transition"
                >
                  {copiedId === s.share_id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => revoke(s.share_id)}
                  disabled={busyId === s.share_id}
                  title="Revoke link"
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
