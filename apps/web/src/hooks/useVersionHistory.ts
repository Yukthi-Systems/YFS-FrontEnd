import { useState } from "react";
import type { FileItem, FileVersion } from "../types/file";
import type { ToastVariant } from "../context/ToastContext";

export function useVersionHistory({
  files,
  restoreVersion,
  showToast,
  closeContextMenu,
}: {
  files: FileItem[];
  restoreVersion: (id: string, versionId: string) => void;
  showToast: (message: string, variant?: ToastVariant) => void;
  closeContextMenu: () => void;
}) {
  const [versionHistoryItemId, setVersionHistoryItemId] = useState<string | null>(null);

  const openVersionHistory = (item: FileItem) => {
    setVersionHistoryItemId(item.id);
    closeContextMenu();
  };

  const closeVersionHistory = () => setVersionHistoryItemId(null);

  const handleRestoreVersion = (versionId: string) => {
    if (!versionHistoryItemId) return;
    restoreVersion(versionHistoryItemId, versionId);
    showToast("Restored previous version", "success");
  };

  const handleDownloadVersion = (version: FileVersion) => {
    if (!version.blobUrl) {
      showToast("No content to download for this version", "error");
      return;
    }
    const item = files.find((f) => f.id === versionHistoryItemId);
    const link = document.createElement("a");
    link.href = version.blobUrl;
    link.download = item ? `${version.savedAt.slice(0, 10)}-${item.name}` : "version";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return { versionHistoryItemId, openVersionHistory, closeVersionHistory, handleRestoreVersion, handleDownloadVersion };
}
