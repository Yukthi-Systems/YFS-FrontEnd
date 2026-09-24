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

import { atom } from "jotai";
import type { GridSize, SortField, SortOrder, ViewMode } from "../types/file";

export interface PublicProfile {
  display_name?: string;
  avatar_color?: string; // CSS colour applied to the initials avatar
}

// Preset avatar colours offered in the profile editor.
export const AVATAR_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#64748b",
] as const;

// Seeded from and saved to private_info by UserSettingsBridge.
export const viewModeAtom = atom<ViewMode>("list");
// Icon size for the "grid" view mode only — Windows-style small/medium/large icons.
export const gridSizeAtom = atom<GridSize>("medium");
export const sortFieldAtom = atom<SortField>("name");
export const sortOrderAtom = atom<SortOrder>("asc");
export const sidebarCollapsedAtom = atom<boolean>(false);
export const publicProfileAtom = atom<PublicProfile>({});
export const savingProfileAtom = atom<boolean>(false);
