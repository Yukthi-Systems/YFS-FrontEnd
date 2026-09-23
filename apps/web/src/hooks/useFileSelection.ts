import { useRef, useState } from "react";
import type { FileItem } from "../types/file";
import { getRangeSelection } from "../utils/selection";

const DOUBLE_CLICK_WINDOW_MS = 400;

// Row selection: single-select (opens the details drawer), shift/ctrl multi-select for
// batch actions, and manual double-click detection for opening an item.
export function useFileSelection({
  listItems,
  onOpenItem,
}: {
  listItems: FileItem[];
  onOpenItem: (item: FileItem) => void;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);

  // Selecting an item opens the details drawer, which reflows the file list (it's a flex
  // sibling, not an overlay) — if that reflow happens on the first click of a double-click,
  // the row moves before the second click lands. So double-click is detected manually via
  // click timestamps, and the actual select-and-open-drawer effect of a single click is
  // deferred until we're sure a second click isn't coming.
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const pendingSelectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSelection = () => {
    if (pendingSelectRef.current) {
      clearTimeout(pendingSelectRef.current);
      pendingSelectRef.current = null;
    }
    setSelectedItemId(null);
  };

  
  const resetSelection = () => {
    clearSelection();
    setCheckedItemIds([]);
    setSelectionAnchorId(null);
  };

  const handleItemClick = (item: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      if (pendingSelectRef.current) {
        clearTimeout(pendingSelectRef.current);
        pendingSelectRef.current = null;
      }
      const range = getRangeSelection(listItems.map((i) => i.id), selectionAnchorId, item.id);
      setCheckedItemIds((prev) => Array.from(new Set([...prev, ...range])));
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (pendingSelectRef.current) {
        clearTimeout(pendingSelectRef.current);
        pendingSelectRef.current = null;
      }
      setCheckedItemIds((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
      setSelectionAnchorId(item.id);
      return;
    }

    const now = Date.now();
    const last = lastClickRef.current;
    if (last && last.id === item.id && now - last.time < DOUBLE_CLICK_WINDOW_MS) {
      // Second click of a double-click: cancel the pending single-click select (it never
      // reflowed the layout, since it was deferred) and open the item instead.
      lastClickRef.current = null;
      if (pendingSelectRef.current) {
        clearTimeout(pendingSelectRef.current);
        pendingSelectRef.current = null;
      }
      onOpenItem(item);
      return;
    }
    lastClickRef.current = { id: item.id, time: now };
    setSelectionAnchorId(item.id);

    // Defer selecting (which opens the details drawer and reflows the file list) until
    // we're sure this isn't the first half of a double-click — otherwise the reflow
    // would move the row out from under the second click before it lands.
    if (pendingSelectRef.current) clearTimeout(pendingSelectRef.current);
    pendingSelectRef.current = setTimeout(() => {
      pendingSelectRef.current = null;
      setSelectedItemId((prev) => (prev === item.id ? null : item.id));
    }, DOUBLE_CLICK_WINDOW_MS);
  };

  const handleCheckboxToggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedItemIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    setSelectionAnchorId(id);
  };

  const handleSelectAllToggle = () => {
    const listIds = listItems.map((item) => item.id);
    const allChecked = listIds.every((id) => checkedItemIds.includes(id));
    if (allChecked) setCheckedItemIds((prev) => prev.filter((id) => !listIds.includes(id)));
    else setCheckedItemIds((prev) => Array.from(new Set([...prev, ...listIds])));
  };

  return {
    selectedItemId,
    checkedItemIds,
    setCheckedItemIds,
    selectionAnchorId,
    clearSelection,
    resetSelection,
    handleItemClick,
    handleCheckboxToggle,
    handleSelectAllToggle,
  };
}
