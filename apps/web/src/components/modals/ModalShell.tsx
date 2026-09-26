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

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function ModalShell({
  children,
  onClose,
  size = "default",
  padded = true,
}: {
  children: ReactNode;
  onClose: () => void;
  size?: "default" | "lg" | "xl";
  // false hands padding to the caller, for modals with their own sticky header/footer.
  padded?: boolean;
}) {
  // Portaled to <body>: a transformed ancestor (e.g. the mobile sidebar drawer) would otherwise trap `position: fixed`.
  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className={`modal-content${size === "default" ? "" : ` modal-${size}`}${padded ? "" : " modal-flush"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
