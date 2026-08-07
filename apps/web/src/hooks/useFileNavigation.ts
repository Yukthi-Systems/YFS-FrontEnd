import { useState } from "react";
import type { FileItem, SidebarTab } from "../types/file";
import type { BreadcrumbSegment } from "../components/layout/Breadcrumbs";

// Owns the current folder path and active sidebar tab (browsing state only — resetting
// selection/search on navigation is the caller's responsibility, since this hook doesn't
// know about either).
export function useFileNavigation() {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("drive");

  const currentFolderId = currentPath[currentPath.length - 1] || null;

  const navigateToFolder = (folderId: string) => {
    setCurrentPath((prev) => [...prev, folderId]);
  };

  const navigateBackTo = (index: number) => {
    setCurrentPath((prev) => (index === -1 ? [] : prev.slice(0, index + 1)));
  };

  const switchTab = (tab: SidebarTab) => {
    setActiveSidebarTab(tab);
    setCurrentPath([]);
  };

  const getBreadcrumbSegments = (files: FileItem[]): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [{ id: null, name: "My Drive" }];
    currentPath.forEach((folderId) => {
      const folder = files.find((f) => f.id === folderId);
      if (folder) segments.push({ id: folderId, name: folder.name });
    });
    return segments;
  };

  return {
    currentPath,
    activeSidebarTab,
    currentFolderId,
    navigateToFolder,
    navigateBackTo,
    switchTab,
    getBreadcrumbSegments,
  };
}
