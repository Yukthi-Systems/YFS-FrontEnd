import { useState } from "react";
import type { FileItem, ShareSettings } from "../types/file";
import type { ToastVariant } from "../context/ToastContext";

export function useShareSettings({
  setShareSettings,
  clearShareSettings,
  showToast,
  closeContextMenu,
}: {
  setShareSettings: (id: string, settings: ShareSettings) => void;
  clearShareSettings: (id: string) => void;
  showToast: (message: string, variant?: ToastVariant) => void;
  closeContextMenu: () => void;
}) {
  const [shareItemId, setShareItemId] = useState<string | null>(null);

  const openShareModal = (item: FileItem) => {
    setShareItemId(item.id);
    closeContextMenu();
  };

  const closeShareModal = () => setShareItemId(null);

  const handleSaveShare = (settings: ShareSettings) => {
    if (!shareItemId) return;
    setShareSettings(shareItemId, settings);
    showToast("Sharing settings saved", "success");
    setShareItemId(null);
  };

  const handleRevokeShare = () => {
    if (!shareItemId) return;
    clearShareSettings(shareItemId);
    showToast("Share link removed", "success");
    setShareItemId(null);
  };

  return { shareItemId, openShareModal, closeShareModal, handleSaveShare, handleRevokeShare };
}
