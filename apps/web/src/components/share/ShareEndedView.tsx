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

import { Check, RotateCcw } from "lucide-react";
import { ShareGate, gatePrimaryButton, gateSecondaryButton } from "./ShareGate";

// Separate route so the share link leaves the address bar; ?from= keeps "Reopen" working.
export function ShareEndedView() {
  const from = new URLSearchParams(window.location.search).get("from") ?? "";

  return (
    <ShareGate
      icon={<Check className="w-7 h-7" />}
      title="You've left this share"
      description="Your access through this link has ended. You can reopen it any time while the link is still active."
    >
      {from && (
        <button onClick={() => window.location.assign(`/share/${encodeURIComponent(from)}`)} className={gatePrimaryButton}>
          <RotateCcw className="w-4 h-4" /> Reopen this share
        </button>
      )}
      <button onClick={() => window.location.assign("/")} className={from ? gateSecondaryButton : gatePrimaryButton}>
        Go to YFS
      </button>
    </ShareGate>
  );
}
