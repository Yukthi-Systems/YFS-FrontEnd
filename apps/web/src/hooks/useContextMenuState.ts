import { useEffect, useState } from "react";
import type { FileItem } from "../types/file";

// Owns the row context menu and the empty-canvas context menu, and closes whichever is
// open on an outside click (excluding their own trigger/dropdown elements).
export function useContextMenuState() {
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!(contextMenuId || canvasContextMenu)) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (contextMenuId && !target.closest(".row-actions-trigger") && !target.closest(".context-dropdown")) {
        setContextMenuId(null);
      }
      if (canvasContextMenu && !target.closest(".context-dropdown")) {
        setCanvasContextMenu(null);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
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
