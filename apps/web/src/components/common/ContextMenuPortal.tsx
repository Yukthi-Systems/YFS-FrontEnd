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

import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

// Portaled to document.body so overflow containers can't clip it.
export function ContextMenuPortal({
  anchor,
  align = "end",
  children,
}: {
  anchor: AnchorRect;
  align?: "start" | "end";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ top: number; left: number; visibility: "hidden" | "visible" }>({
    top: anchor.bottom + 6,
    left: align === "end" ? anchor.right : anchor.left,
    visibility: "hidden",
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    let top = anchor.bottom + 6;
    let left = align === "end" ? anchor.right - rect.width : anchor.left;

    if (top + rect.height > window.innerHeight - 8) top = Math.max(8, anchor.top - rect.height - 6);
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    setStyle({ top, left, visibility: "visible" });
  }, [anchor.top, anchor.left, anchor.right, anchor.bottom, align]);

  return createPortal(
    <div ref={ref} className="fixed z-[2000]" style={{ top: style.top, left: style.left, visibility: style.visibility }}>
      {children}
    </div>,
    document.body
  );
}
