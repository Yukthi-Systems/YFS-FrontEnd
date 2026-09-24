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

import { Clock, Eye, Info, PencilLine } from "lucide-react";
import type { InternalSharePermissions, PublicSession, PublicSessionInfo } from "@yfs/service";
import { formatDate } from "../../utils/format";

const PERMS: { key: keyof InternalSharePermissions; label: string }[] = [
  { key: "can_preview", label: "Preview" },
  { key: "can_download", label: "Download" },
  { key: "can_create", label: "Create folders" },
  { key: "can_update", label: "Rename & move" },
  { key: "can_delete", label: "Delete" },
];

const canEdit = (p: InternalSharePermissions) => p.can_update || p.can_create || p.can_delete;

const accessSummary = (p: InternalSharePermissions): string =>
  canEdit(p) ? "Can edit" : p.can_download ? "View & download" : "View only";

export function ShareAccessBadge({ info, session }: { info: PublicSessionInfo; session: PublicSession | null }) {
  const p = info.permission_set;
  const granted = PERMS.filter(({ key }) => p[key]).map(({ label }) => label);
  const expiry = session?.expires_at ? `Expires ${formatDate(session.expires_at)}` : "Doesn't expire";
  const Icon = canEdit(p) ? PencilLine : Eye;

  return (
    <div className="flex items-center gap-2 min-w-0" title={`${granted.join(" · ") || "No permissions"}\n${expiry}`}>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-bg text-accent border border-accent-border text-xs font-semibold shrink-0">
        <Icon className="w-3.5 h-3.5" />
        {accessSummary(p)}
      </span>
      {session?.expires_at && (
        <span className="inline-flex items-center gap-1 text-xs text-text-main truncate max-[640px]:hidden">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {expiry}
        </span>
      )}
    </div>
  );
}

export function ShareNoteBanner({ note }: { note: string }) {
  return (
    <div className="flex items-start gap-2.5 bg-accent-bg border border-accent-border text-text-heading px-3.5 py-2.5 rounded-xl text-xs leading-relaxed">
      <Info className="w-4 h-4 shrink-0 text-accent mt-px" />
      <span className="whitespace-pre-line">{note}</span>
    </div>
  );
}
