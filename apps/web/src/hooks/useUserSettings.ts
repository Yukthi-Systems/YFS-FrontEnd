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

import { useAtom, useAtomValue } from "jotai";
import {
  viewModeAtom,
  gridSizeAtom,
  sortFieldAtom,
  sortOrderAtom,
  sidebarCollapsedAtom,
  publicProfileAtom,
  savingProfileAtom,
  type PublicProfile,
} from "../atoms/userSettings";
import { useIsMobile } from "./useIsMobile";

export { AVATAR_COLORS } from "../atoms/userSettings";

// Server-backed preferences (see UserSettingsBridge); defaults until loaded.
export const useUserSettings = () => {
  const [storedViewMode, setViewMode] = useAtom(viewModeAtom);
  // No table on phones: list falls back to tiles without changing the saved preference.
  const isMobile = useIsMobile();
  const viewMode = isMobile && storedViewMode === "list" ? "tiles" : storedViewMode;
  const [gridSize, setGridSize] = useAtom(gridSizeAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom);
  const [publicProfile, setPublicProfile] = useAtom(publicProfileAtom);
  const savingProfile = useAtomValue(savingProfileAtom);

  const savePublicProfile = (patch: PublicProfile) => setPublicProfile((p) => ({ ...p, ...patch }));

  return {
    viewMode,
    gridSize,
    sortField,
    sortOrder,
    sidebarCollapsed,
    setViewMode,
    setGridSize,
    setSortField,
    setSortOrder,
    setSidebarCollapsed,
    publicProfile,
    savePublicProfile,
    savingProfile,
  };
};
