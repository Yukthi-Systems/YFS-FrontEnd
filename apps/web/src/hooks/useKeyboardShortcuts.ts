import { useEffect } from "react";

// Global Delete/Enter/Escape shortcuts. Disabled while a modal/viewer with its
// own key handling (or a text input) is focused/open, so they don't double-fire.
export function useKeyboardShortcuts({
  enabled,
  onDelete,
  onEnter,
  onEscape,
}: {
  enabled: boolean;
  onDelete: () => void;
  onEnter: () => void;
  onEscape: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isTyping) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDelete();
      } else if (e.key === "Enter") {
        onEnter();
      } else if (e.key === "Escape") {
        onEscape();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [enabled, onDelete, onEnter, onEscape]);
}
