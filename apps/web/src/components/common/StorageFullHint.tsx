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

import { AlertTriangle } from "lucide-react";
import { useRefreshUserQuota } from "../../hooks/useUserQuota";
import { useRefreshSession } from "../../hooks/useAuth";

const linkClass =
  "inline border-none bg-transparent p-0 font-semibold text-accent underline underline-offset-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed";

// Shown where folder creation is blocked because the user's own storage is full.
export function StorageFullHint() {
  const { refreshQuota, refreshing } = useRefreshUserQuota();
  const { refreshSession, refreshingSession } = useRefreshSession();

  return (
    <div
      className="mx-1 my-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] leading-snug text-text-main"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 font-semibold text-red-500 mb-0.5">
        <AlertTriangle className="w-3.5 h-3.5" /> Storage full
      </div>
      Free up space to create folders. Deleted files recently?{" "}
      <button onClick={() => refreshQuota().catch(() => {})} disabled={refreshing} className={linkClass}>
        {refreshing ? "Recalculating…" : "Recalculate usage"}
      </button>
      . Quota increased by your admin?{" "}
      <button onClick={() => refreshSession()} disabled={refreshingSession} className={linkClass}>
        {refreshingSession ? "Refreshing…" : "Refresh session"}
      </button>
      .
    </div>
  );
}
