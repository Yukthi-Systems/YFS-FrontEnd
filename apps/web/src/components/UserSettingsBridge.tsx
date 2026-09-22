import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import { getUserById, updateUserInfo } from "@yfs/service";
import { useAuth } from "../hooks/useAuth";
import { withAuthRetry } from "../utils/authRetry";
import { useTheme, useAccentColor } from "../atoms/theme";
import { showToast } from "../atoms/toast";
import {
  viewModeAtom,
  gridSizeAtom,
  sortFieldAtom,
  sortOrderAtom,
  sidebarCollapsedAtom,
  starredIdsAtom,
  publicProfileAtom,
  savingProfileAtom,
} from "../atoms/userSettings";
import type { GridSize, SortField, SortOrder, ViewMode } from "../types/file";
import type { Theme } from "../utils/theme";

// Server-backed per-user settings, split across the two `users` blobs YFS-Main-API
// exposes on GET /user/user-by-id/{self}:
//   - private_info: UI preferences, visible only to the user (theme, view mode, …)
//   - public_info:  profile fields the whole org can see (display name, avatar colour)
// Both are written back wholesale via PATCH /user/update-user-info/{isPublic}, so we
// keep the full blob in a ref and merge the current atom values into it before saving
// (debounced). Render once, alongside AuthBridge — the atoms it seeds/persists are read
// and written by useUserSettings() anywhere else in the tree.

const SAVE_DEBOUNCE_MS = 700;

const THEMES: Theme[] = ["light", "dark", "system"];
const VIEW_MODES: ViewMode[] = ["list", "tiles", "grid"];
const GRID_SIZES: GridSize[] = ["small", "medium", "large"];
const SORT_FIELDS: SortField[] = ["name", "modifiedAt", "size"];
const SORT_ORDERS: SortOrder[] = ["asc", "desc"];

const oneOf = <T,>(allowed: readonly T[], v: unknown): T | undefined =>
  allowed.includes(v as T) ? (v as T) : undefined;

interface PrivateBlob {
  theme?: Theme;
  accentColor?: string;
  viewMode?: ViewMode;
  gridSize?: GridSize;
  sortField?: SortField;
  sortOrder?: SortOrder;
  sidebarCollapsed?: boolean;
  starredIds?: string[];
  [k: string]: unknown; // preserve keys we don't model
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

export function UserSettingsBridge() {
  const { token, userId, refreshAccessToken } = useAuth();
  const { theme, setTheme } = useTheme();
  const { accentColor, setAccentColor } = useAccentColor();
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [gridSize, setGridSize] = useAtom(gridSizeAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom);
  const [starredIds, setStarredIds] = useAtom(starredIdsAtom);
  const [publicProfile, setPublicProfile] = useAtom(publicProfileAtom);
  const setSavingProfile = useSetAtom(savingProfileAtom);

  const query = useQuery({
    queryKey: ["userSettings", userId],
    queryFn: () => withAuthRetry(token, refreshAccessToken, (tk) => getUserById(tk, userId!)),
    enabled: !!token && !!userId,
  });

  useEffect(() => {
    if (query.isError) {
      showToast(query.error instanceof Error ? query.error.message : "Couldn't load your preferences", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isError]);

  const privateBlobRef = useRef<PrivateBlob>({});
  const publicBlobRef = useRef<Record<string, unknown>>({});
  const privTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pubTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initedRef = useRef(false);

  // Re-arm the one-time server->client apply across a logout/login.
  useEffect(() => {
    if (!token || !userId) {
      initedRef.current = false;
      privateBlobRef.current = {};
      publicBlobRef.current = {};
    }
  }, [token, userId]);

  // Apply the loaded blobs once per login.
  useEffect(() => {
    if (!query.data || initedRef.current) return;
    initedRef.current = true;
    const priv = (query.data.private_info ?? {}) as PrivateBlob;
    const pub = (query.data.public_info ?? {}) as Record<string, unknown>;
    privateBlobRef.current = { ...priv };
    publicBlobRef.current = { ...pub };

    const vm = oneOf(VIEW_MODES, priv.viewMode);
    const gs = oneOf(GRID_SIZES, priv.gridSize);
    const sf = oneOf(SORT_FIELDS, priv.sortField);
    const so = oneOf(SORT_ORDERS, priv.sortOrder);
    const th = oneOf(THEMES, priv.theme);
    if (vm) setViewMode(vm);
    if (gs) setGridSize(gs);
    if (sf) setSortField(sf);
    if (so) setSortOrder(so);
    if (typeof priv.sidebarCollapsed === "boolean") setSidebarCollapsed(priv.sidebarCollapsed);
    if (th && th !== theme) setTheme(th);
    if (typeof priv.accentColor === "string") setAccentColor(priv.accentColor);
    if (Array.isArray(priv.starredIds)) setStarredIds(priv.starredIds.filter((id) => typeof id === "string"));
    setPublicProfile({
      display_name: typeof pub.display_name === "string" ? pub.display_name : undefined,
      avatar_color: typeof pub.avatar_color === "string" ? pub.avatar_color : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  // Push local pref changes back to the server, whole-blob, debounced. Comparing
  // against the last-known blob (seeded from the server above) means the apply-on-load
  // above doesn't itself trigger a redundant round trip.
  useEffect(() => {
    if (!initedRef.current) return;
    const prev = privateBlobRef.current;
    const unchanged =
      prev.theme === theme &&
      prev.accentColor === (accentColor ?? undefined) &&
      prev.viewMode === viewMode &&
      prev.gridSize === gridSize &&
      prev.sortField === sortField &&
      prev.sortOrder === sortOrder &&
      prev.sidebarCollapsed === sidebarCollapsed &&
      sameIds(prev.starredIds ?? [], starredIds);
    privateBlobRef.current = {
      ...prev,
      theme,
      accentColor: accentColor ?? undefined,
      viewMode,
      gridSize,
      sortField,
      sortOrder,
      sidebarCollapsed,
      starredIds,
    };
    if (unchanged) return;
    clearTimeout(privTimer.current);
    privTimer.current = setTimeout(() => {
      if (!token) return;
      withAuthRetry(token, refreshAccessToken, (tk) => updateUserInfo(tk, "private", privateBlobRef.current)).catch(
        (err) => {
          console.warn("private_info save failed", err);
          showToast(err instanceof Error ? err.message : "Couldn't save your preferences", "error");
        }
      );
    }, SAVE_DEBOUNCE_MS);
  }, [theme, accentColor, viewMode, gridSize, sortField, sortOrder, sidebarCollapsed, starredIds, token, refreshAccessToken]);

  useEffect(() => {
    if (!initedRef.current) return;
    const prev = publicBlobRef.current;
    const unchanged = prev.display_name === publicProfile.display_name && prev.avatar_color === publicProfile.avatar_color;
    publicBlobRef.current = { ...prev, ...publicProfile };
    if (unchanged) return;
    setSavingProfile(true);
    clearTimeout(pubTimer.current);
    pubTimer.current = setTimeout(() => {
      if (!token) {
        setSavingProfile(false);
        return;
      }
      withAuthRetry(token, refreshAccessToken, (tk) => updateUserInfo(tk, "public", publicBlobRef.current))
        .catch((err) => {
          console.warn("public_info save failed", err);
          showToast(err instanceof Error ? err.message : "Couldn't save your profile", "error");
        })
        .finally(() => setSavingProfile(false));
    }, SAVE_DEBOUNCE_MS);
  }, [publicProfile, token, setSavingProfile, refreshAccessToken]);

  return null;
}
