import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import { getUserById, updateUserInfo } from "@yfs/service";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../atoms/theme";
import {
  viewModeAtom,
  sortFieldAtom,
  sortOrderAtom,
  sidebarCollapsedAtom,
  publicProfileAtom,
  savingProfileAtom,
} from "../atoms/userSettings";
import type { SortField, SortOrder, ViewMode } from "../types/file";
import type { Theme } from "../utils/theme";

// Server-backed per-user settings, split across the two `users` blobs YFS-Main-API
// exposes on GET /user/user-by-id/{self}:
//   - private_info: UI preferences, visible only to the user (theme, view mode, …)
//   - public_info:  profile fields the whole org can see (display name, avatar colour)
// Both are written back wholesale via PATCH /user/update-user-info/{isPublic}, so we
// keep the full blob in a ref and merge the current atom values into it before saving
// (debounced). Render once, under AuthProvider — the atoms it seeds/persists are read
// and written by useUserSettings() anywhere else in the tree.

const SAVE_DEBOUNCE_MS = 700;

const THEMES: Theme[] = ["light", "dark", "system"];
const VIEW_MODES: ViewMode[] = ["list", "grid"];
const SORT_FIELDS: SortField[] = ["name", "modifiedAt", "size"];
const SORT_ORDERS: SortOrder[] = ["asc", "desc"];

const oneOf = <T,>(allowed: readonly T[], v: unknown): T | undefined =>
  allowed.includes(v as T) ? (v as T) : undefined;

interface PrivateBlob {
  theme?: Theme;
  viewMode?: ViewMode;
  sortField?: SortField;
  sortOrder?: SortOrder;
  sidebarCollapsed?: boolean;
  [k: string]: unknown; // preserve keys we don't model
}

export function UserSettingsBridge() {
  const { token, userId } = useAuth();
  const { theme, setTheme } = useTheme();
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom);
  const [publicProfile, setPublicProfile] = useAtom(publicProfileAtom);
  const setSavingProfile = useSetAtom(savingProfileAtom);

  const query = useQuery({
    queryKey: ["userSettings", userId],
    queryFn: () => getUserById(token!, userId!),
    enabled: !!token && !!userId,
  });

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
    const sf = oneOf(SORT_FIELDS, priv.sortField);
    const so = oneOf(SORT_ORDERS, priv.sortOrder);
    const th = oneOf(THEMES, priv.theme);
    if (vm) setViewMode(vm);
    if (sf) setSortField(sf);
    if (so) setSortOrder(so);
    if (typeof priv.sidebarCollapsed === "boolean") setSidebarCollapsed(priv.sidebarCollapsed);
    if (th && th !== theme) setTheme(th);
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
      prev.viewMode === viewMode &&
      prev.sortField === sortField &&
      prev.sortOrder === sortOrder &&
      prev.sidebarCollapsed === sidebarCollapsed;
    privateBlobRef.current = { ...prev, theme, viewMode, sortField, sortOrder, sidebarCollapsed };
    if (unchanged) return;
    clearTimeout(privTimer.current);
    privTimer.current = setTimeout(() => {
      if (!token) return;
      updateUserInfo(token, "private", privateBlobRef.current).catch((err) =>
        console.warn("private_info save failed", err)
      );
    }, SAVE_DEBOUNCE_MS);
  }, [theme, viewMode, sortField, sortOrder, sidebarCollapsed, token]);

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
      updateUserInfo(token, "public", publicBlobRef.current)
        .catch((err) => console.warn("public_info save failed", err))
        .finally(() => setSavingProfile(false));
    }, SAVE_DEBOUNCE_MS);
  }, [publicProfile, token, setSavingProfile]);

  return null;
}
