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
  // Version open in the read-only viewer; the history modal hides meanwhile and returns on close.
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);

  // Server versions; the local FileItem.version can be stale.
  const { data: fileInfo, isLoading: isLoadingVersions } = useFileInfo(item, !!versionHistoryItemId);
  const { downloadFileVersion } = useDownload();

  const { latestVersion, olderVersions } = useMemo(() => {
    const available = fileInfo?.available_versions ?? [];
    const latest = available.length ? Math.max(...available) : (item?.version ?? 1);
    const older = available.filter((v) => v !== latest).sort((a, b) => b - a);
    return { latestVersion: latest, olderVersions: older };
  }, [fileInfo, item]);

  // Viewers load whatever `version` says, so pinning it opens that version.
  const viewingItem = useMemo(
    () => (item && viewingVersion !== null ? { ...item, version: viewingVersion } : null),
    [item, viewingVersion]
  );

  const openVersionHistory = (target: FileItem) => {
    setVersionHistoryItemId(target.id);
    setViewingVersion(null);
    closeContextMenu();
  };

  const closeVersionHistory = () => {
    setVersionHistoryItemId(null);
    setViewingVersion(null);
  };

  const handleViewVersion = (version: number) => setViewingVersion(version);
  const closeVersionViewer = () => setViewingVersion(null);

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
    viewingItem,
    viewingVersion,
    openVersionHistory,
    closeVersionHistory,
    handleDownloadVersion,
    handleViewVersion,
    closeVersionViewer,
  };
}
