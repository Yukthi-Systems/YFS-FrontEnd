import { useState } from "react";
import { Check, Copy, FileText, Folder, Link2, Trash2 } from "lucide-react";
import type { ExternalShare } from "@yfs/service";
import { formatDate } from "../../utils/format";

const shareUrl = (shareId: string) => `${window.location.origin}/share/${shareId}`;

const permList = (s: ExternalShare) =>
  [
    s.can_preview && "preview",
    s.can_download && "download",
    s.can_create && "create",
    s.can_update && "edit",
    s.can_delete && "delete",
  ]
    .filter(Boolean)
    .join(", ") || "no permissions";

// "Shared by link" view — every external link I've created.
export function SharedLinksList({
  links,
  onRevoke,
}: {
  links: ExternalShare[];
  onRevoke: (shareId: string) => Promise<void>;
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
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-text-heading">Shared by link</h2>
      {links.map((s) => (
        <div
          key={s.share_id}
          className="bg-bg-main border border-border-main rounded-xl px-3.5 py-3 flex items-center gap-3"
        >
          {s.share_folder_target_id ? (
            <Folder className="w-4 h-4 text-accent shrink-0" />
          ) : (
            <FileText className="w-4 h-4 text-text-main shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-mono text-text-heading truncate">{shareUrl(s.share_id)}</div>
            <div className="text-[11px] text-text-main flex flex-wrap gap-x-2">
              <span>{permList(s)}</span>
              {s.password_hash && <span>· password</span>}
              {s.emails_for_otp.length > 0 && <span>· OTP to {s.emails_for_otp.length}</span>}
              {s.expires_at && <span>· expires {formatDate(s.expires_at)}</span>}
              <span>· created {formatDate(s.created_at)}</span>
            </div>
          </div>
          <button
            onClick={() => copy(s.share_id)}
            title="Copy link"
            className="p-1.5 rounded-lg text-text-main hover:bg-code-bg shrink-0"
          >
            {copiedId === s.share_id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => revoke(s.share_id)}
            disabled={busyId === s.share_id}
            title="Revoke link"
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 shrink-0 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
