import { useMemo, useState } from "react";
import type { FileItem } from "../types/file";
import type { ToastVariant } from "../atoms/toast";
import { useFileInfo } from "./useFileInfo";
import { useDownload } from "./useDownload";

export function useVersionHistory({
  files,
  showToast,
  closeContextMenu,
}: {
  files: FileItem[];
  showToast: (message: string, variant?: ToastVariant) => void;
  closeContextMenu: () => void;
}) {
  const [versionHistoryItemId, setVersionHistoryItemId] = useState<string | null>(null);
  const item = files.find((f) => f.id === versionHistoryItemId) ?? null;

  // Real version numbers from the server (POST /files/get-info), not the local
  // FileItem.version — that's only ever right if this tab is what last uploaded it.
  const { data: fileInfo, isLoading: isLoadingVersions } = useFileInfo(item, !!versionHistoryItemId);
  const { downloadFileVersion } = useDownload();

  const { latestVersion, olderVersions } = useMemo(() => {
    const available = fileInfo?.available_versions ?? [];
    const latest = available.length ? Math.max(...available) : (item?.version ?? 1);
    const older = available.filter((v) => v !== latest).sort((a, b) => b - a);
    return { latestVersion: latest, olderVersions: older };
  }, [fileInfo, item]);

  const openVersionHistory = (target: FileItem) => {
    setVersionHistoryItemId(target.id);
    closeContextMenu();
  };

  const closeVersionHistory = () => setVersionHistoryItemId(null);

  const handleDownloadVersion = async (version: number) => {
    if (!item) return;
    try {
      const ok = await downloadFileVersion(item, version);
      if (!ok) showToast("No content to download for this version", "error");
    } catch {
      showToast("Couldn't download that version", "error");
    }
  };

  return {
    versionHistoryItemId,
    item,
    latestVersion,
    olderVersions,
    isLoadingVersions,
    openVersionHistory,
    closeVersionHistory,
    handleDownloadVersion,
  };
}
