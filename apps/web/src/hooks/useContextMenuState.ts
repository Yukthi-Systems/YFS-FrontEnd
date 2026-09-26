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

import { useEffect, useState } from "react";
import type { FileItem } from "../types/file";

export function useContextMenuState() {
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!(contextMenuId || canvasContextMenu)) return;
    const handleOutsideClick = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (contextMenuId && !target.closest(".row-actions-trigger") && !target.closest(".context-dropdown")) {
        setContextMenuId(null);
      }
      if (canvasContextMenu && !target.closest(".context-dropdown")) {
        setCanvasContextMenu(null);
      }
    };
    // Capture phase so toolbars that stopPropagation (and right-clicks) still close it.
    document.addEventListener("pointerdown", handleOutsideClick, true);
    return () => document.removeEventListener("pointerdown", handleOutsideClick, true);
  }, [contextMenuId, canvasContextMenu]);

  const openItemContextMenu = (item: FileItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCanvasContextMenu(null);
    setContextMenuId((prev) => (prev === item.id ? null : item.id));
  };

  const openCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuId(null);
    setCanvasContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenuId(null);

  const dismissAll = () => {
    setContextMenuId(null);
    setCanvasContextMenu(null);
  };

  return {
    contextMenuId,
    setContextMenuId,
    canvasContextMenu,
    setCanvasContextMenu,
    openItemContextMenu,
    openCanvasContextMenu,
    closeContextMenu,
    dismissAll,
  };
}
