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
import type { FileItem, SidebarTab } from "../types/file";
import type { BreadcrumbSegment } from "../components/layout/Breadcrumbs";
import { buildAppRoute, parseAppRoute } from "../utils/appRoute";

// Current tab and folder path, synced to the URL so refresh and back/forward work.
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

  // Sets tab and path together to avoid a stale `currentPath` closure.
  const openPath = (tab: SidebarTab, path: string[]) => {
    pushRoute(tab, path);
    setActiveSidebarTab(tab);
    setCurrentPath(path);
  };

  const switchTab = (tab: SidebarTab) => openPath(tab, []);

  // Follow a temp id → server id swap; replaces the history entry since it's the same folder.
  const replacePathIds = (remap: Record<string, string>) => {
    setCurrentPath((prev) => {
      if (!prev.some((id) => remap[id])) return prev;
      const next = prev.map((id) => remap[id] ?? id);
      const url = buildAppRoute(activeSidebarTab, next);
      if (url !== window.location.pathname) window.history.replaceState(null, "", url);
      return next;
    });
  };

  // Back/forward: read state from the URL without pushing a new entry.
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
      activeSidebarTab === "trash"
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
    replacePathIds,
    getBreadcrumbSegments,
  };
}
