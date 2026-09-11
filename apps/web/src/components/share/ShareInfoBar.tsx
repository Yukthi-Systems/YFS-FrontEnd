import { Check, Clock, Hash, Info } from "lucide-react";
import type { InternalSharePermissions, PublicSession, PublicSessionInfo } from "@yfs/service";
import { formatDate } from "../../utils/format";

// Surfaces the share-level details from POST /public/session + GET /public/session
// that the visitor should be able to see: what they're allowed to do, when the link
// expires, its id, and any note the owner attached.

const PERMS: { key: keyof InternalSharePermissions; label: string }[] = [
  { key: "can_preview", label: "Preview" },
  { key: "can_download", label: "Download" },
  { key: "can_create", label: "Create" },
  { key: "can_update", label: "Edit" },
  { key: "can_delete", label: "Delete" },
];

const accessSummary = (info: PublicSessionInfo): string => {
  const p = info.permission_set;
  if (p.can_update || p.can_create || p.can_delete) return "You can edit this folder";
  if (p.can_download) return "View & download";
  if (p.can_preview) return "View only";
  return "No access";
};

// share_info is an owner-controlled JSONB blob; show a note if one's in there.
const shareNote = (raw: Record<string, unknown>): string | null => {
  for (const k of ["note", "message", "description", "title"]) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

export function ShareInfoBar({
  info,
  session,
  shareId,
  permissionsOnly = false,
}: {
  info: PublicSessionInfo;
  session: PublicSession | null;
  shareId: string;
  permissionsOnly?: boolean;
}) {
  const note = session ? shareNote(session.share_info) : null;

  return (
    <div className="rounded-xl border border-border-main bg-code-bg/60 px-3 py-2.5 flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-semibold text-text-heading">{accessSummary(info)}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          {PERMS.filter(({ key }) => info.permission_set[key]).map(({ key, label }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-accent-bg text-accent border border-accent-border"
            >
              <Check className="w-3 h-3" />
              {label}
            </span>
          ))}
        </span>
      </div>

      {!permissionsOnly && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-text-main">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {session?.expires_at ? `Expires ${formatDate(session.expires_at)}` : "No expiry"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5" />
            {shareId || info.share_id}
          </span>
        </div>
      )}

      {note && (
        <div className="flex items-start gap-1.5 text-text-heading">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" />
          <span>{note}</span>
        </div>
      )}
    </div>
  );
}
