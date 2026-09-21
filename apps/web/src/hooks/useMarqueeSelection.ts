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

// Windows-style click-and-drag rectangle selection: mousedown on empty background
// starts a drag; any rendered item under `container` with a `data-item-id`
// attribute that the rectangle overlaps gets selected, live, as the drag moves.
// Holding Ctrl/Cmd at drag-start adds to the existing selection instead of
// replacing it. Coordinates are viewport-relative throughout (getBoundingClientRect
// on both the rectangle and each item), so this stays correct even if the
// container scrolls mid-drag — no manual scroll-offset math needed.
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
    // Never start a drag-select from an item, or from a button/input/link inside
    // the background chrome (filter bar, breadcrumbs, etc.).
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

      // A real drag ended — swallow the click it produces so it doesn't also fire
      // onItemClick (on whatever's under the cursor) or clear the selection via the
      // background's own click handler.
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
