import { useState } from "react";
import type { FileItem } from "../types/file";

// Just open/close state for the ShareModal now — the modal talks to
// YFS-Main-API's /share/internal/* endpoints itself.
export function useShareSettings({ closeContextMenu }: { closeContextMenu: () => void }) {
  const [shareItemId, setShareItemId] = useState<string | null>(null);

  const openShareModal = (item: FileItem) => {
    setShareItemId(item.id);
    closeContextMenu();
  };

  const closeShareModal = () => setShareItemId(null);

  return { shareItemId, openShareModal, closeShareModal };
}
