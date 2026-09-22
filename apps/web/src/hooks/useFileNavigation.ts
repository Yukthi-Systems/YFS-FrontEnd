import { useEffect, useState } from "react";
import type { FileItem, SidebarTab } from "../types/file";
import type { BreadcrumbSegment } from "../components/layout/Breadcrumbs";
import { buildAppRoute, parseAppRoute } from "../utils/appRoute";

// Owns the current folder path and active sidebar tab (browsing state only — resetting
// selection/search on navigation is the caller's responsibility, since this hook doesn't
// know about either). Synced to the URL (see utils/appRoute) so a refresh — or the
// browser back/forward buttons — lands back on the same tab/folder instead of resetting
// to My Drive; restoring a deep folder path's *data* (loading ancestors so breadcrumbs
// and shared-folder detection work) is the caller's job, since that needs useFileSystem.
export function useFileNavigation() {
  const [initialRoute] = useState(() => parseAppRoute(window.location.pathname));
  const [currentPath, setCurrentPath] = useState<string[]>(initialRoute.path);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>(initialRoute.tab);

  const currentFolderId = currentPath[currentPath.length - 1] || null;

  const pushRoute = (tab: SidebarTab, path: string[]) => {
    const url = buildAppRoute(tab, path);
    if (url !== window.location.pathname) window.history.pushState(null, "", url);
  };

  const navigateToFolder = (folderId: string) => {
    const next = [...currentPath, folderId];
    pushRoute(activeSidebarTab, next);
    setCurrentPath(next);
  };

  const navigateBackTo = (index: number) => {
    const next = index === -1 ? [] : currentPath.slice(0, index + 1);
    pushRoute(activeSidebarTab, next);
    setCurrentPath(next);
  };

  // Jump straight to a tab + path in one go — e.g. opening a folder from "Shared by
  // link" lands it in My Drive regardless of whatever tab/path was active before.
  // Setting both pieces of state together (rather than switchTab + navigateToFolder)
  // avoids computing the new path off a stale `currentPath` closure.
  const openPath = (tab: SidebarTab, path: string[]) => {
    pushRoute(tab, path);
    setActiveSidebarTab(tab);
    setCurrentPath(path);
  };

  const switchTab = (tab: SidebarTab) => openPath(tab, []);

  // Browser back/forward: re-derive state from the URL rather than going through
  // pushRoute above, which would push a fresh history entry over the one just popped.
  useEffect(() => {
    const onPopState = () => {
      const route = parseAppRoute(window.location.pathname);
      setActiveSidebarTab(route.tab);
      setCurrentPath(route.path);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const getBreadcrumbSegments = (files: FileItem[]): BreadcrumbSegment[] => {
    const rootName =
      activeSidebarTab === "starred"
        ? "Starred"
        : activeSidebarTab === "trash"
        ? "Trash"
        : activeSidebarTab === "shared"
        ? "Shared with you"
        : activeSidebarTab === "shared-out"
        ? "Shared by you"
        : activeSidebarTab === "shared-links"
        ? "Shared by link"
        : activeSidebarTab === "recent"
        ? "Recent"
        : "My Drive";
    const segments: BreadcrumbSegment[] = [{ id: null, name: rootName }];
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
    openPath,
    switchTab,
    getBreadcrumbSegments,
  };
}
