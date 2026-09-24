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
import type { FileItem } from "../types/file";
import { getRangeSelection } from "../utils/selection";

const DOUBLE_CLICK_WINDOW_MS = 400;

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

  // Single-click select is deferred so the drawer's reflow can't move the row before a double-click's second click.
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
