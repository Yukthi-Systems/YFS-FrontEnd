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

import { useRef, useState } from "react";

export interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const DRAG_THRESHOLD_PX = 4;

const rectsIntersect = (a: DOMRect, b: MarqueeRect): boolean =>
  a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;

// Drag-rectangle selection over elements with `data-item-id`; Ctrl/Cmd adds to the selection.
export function useMarqueeSelection({
  container,
  checkedItemIds,
  onSelectionChange,
}: {
  container: HTMLElement | null;
  checkedItemIds: string[];
  onSelectionChange: (ids: string[]) => void;
}) {
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const checkedItemIdsRef = useRef(checkedItemIds);
  checkedItemIdsRef.current = checkedItemIds;

  const updateSelection = (rect: MarqueeRect, baseIds: string[]) => {
    if (!container) return;
    const intersected: string[] = [];
    container.querySelectorAll<HTMLElement>("[data-item-id]").forEach((el) => {
      if (rectsIntersect(el.getBoundingClientRect(), rect)) {
        const id = el.dataset.itemId;
        if (id) intersected.push(id);
      }
    });
    onSelectionChange(Array.from(new Set([...baseIds, ...intersected])));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-item-id], button, a, input, textarea, select")) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const baseIds = e.ctrlKey || e.metaKey ? checkedItemIdsRef.current : [];
    let dragging = false;

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      dragging = true;

      const rect: MarqueeRect = {
        left: Math.min(startX, ev.clientX),
        top: Math.min(startY, ev.clientY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      };
      setMarqueeRect(rect);
      updateSelection(rect, baseIds);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setMarqueeRect(null);
      if (!dragging) return;

      // Swallow the click that ends a real drag.
      if (!container) return;
      const swallow = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      container.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => container.removeEventListener("click", swallow, { capture: true }), 0);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return { onMouseDown, marqueeRect };
}
