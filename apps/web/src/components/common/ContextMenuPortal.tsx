import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

// Renders a dropdown outside the normal DOM tree (into document.body) so it can't be
// clipped by an ancestor's overflow — e.g. the file table's horizontal-scroll wrapper,
// which the CSS spec forces into overflow-y: auto too once overflow-x isn't "visible",
// turning it into an accidental clipping/scrolling box for anything positioned inside it.
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
