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

// View preferences — seeded from private_info by UserSettingsBridge once loaded,
// written through on change (also by UserSettingsBridge, debounced).
export const viewModeAtom = atom<ViewMode>("list");
// Icon size for the "grid" view mode only — Windows-style small/medium/large icons.
export const gridSizeAtom = atom<GridSize>("medium");
export const sortFieldAtom = atom<SortField>("name");
export const sortOrderAtom = atom<SortOrder>("asc");
export const sidebarCollapsedAtom = atom<boolean>(false);
const STARRED_STORAGE_KEY = "yfs_starred_ids";
export const getStoredStarredIds = (): string[] => {
  try {
    const raw = localStorage.getItem(STARRED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const setStoredStarredIds = (ids: string[]) => {
  try {
    localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify(ids));
  } catch {}
};

// Starred file/folder ids — personal, per-user state, so it lives in private_info
// rather than on the shared resource itself (starring something you don't own, or
// that's shared with others, must not star it for anyone else). Seeded/written the
// same way as the other private_info-backed atoms above, and cached locally for instant boot.
export const starredIdsAtom = atom<string[]>(getStoredStarredIds());

export const publicProfileAtom = atom<PublicProfile>({});
export const savingProfileAtom = atom<boolean>(false);
