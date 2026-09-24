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

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import { getUserById, updateUserInfo, type BasicUserInfo } from "@yfs/service";
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
  publicProfileAtom,
  savingProfileAtom,
} from "../atoms/userSettings";
import type { GridSize, SortField, SortOrder, ViewMode } from "../types/file";
import type { Theme } from "../utils/theme";
import { queryClient, userQueryKey, USER_STALE_MS } from "../lib/queryClient";

// Syncs private_info (UI prefs) and public_info (profile) with the server. Both are written wholesale, so values are merged before a debounced save.

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
  [k: string]: unknown; // preserve keys we don't model
}

// Keep the shared user cache in step with what was just saved.
const patchCachedUser = (userId: string | null, patch: Partial<BasicUserInfo>) => {
  if (!userId) return;
  queryClient.setQueryData<BasicUserInfo | null>(userQueryKey(userId), (old) => (old ? { ...old, ...patch } : old));
};

export function UserSettingsBridge() {
  const { token, userId, refreshAccessToken } = useAuth();
  const { theme, setTheme } = useTheme();
  const { accentColor, setAccentColor } = useAccentColor();
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [gridSize, setGridSize] = useAtom(gridSizeAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom);
  const [publicProfile, setPublicProfile] = useAtom(publicProfileAtom);
  const setSavingProfile = useSetAtom(savingProfileAtom);

  const query = useQuery({
    queryKey: userQueryKey(userId ?? ""),
    queryFn: () => withAuthRetry(token, refreshAccessToken, (tk) => getUserById(tk, userId!)),
    enabled: !!token && !!userId,
    staleTime: USER_STALE_MS,
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
  const justAppliedServerRef = useRef(false);
  const justAppliedPublicRef = useRef(false);

  // Re-arm the one-time server->client apply across a logout/login.
  useEffect(() => {
    if (!token || !userId) {
      initedRef.current = false;
      justAppliedServerRef.current = false;
      justAppliedPublicRef.current = false;
      privateBlobRef.current = {};
      publicBlobRef.current = {};
    }
  }, [token, userId]);

  // Apply the loaded blobs once per login.
  useEffect(() => {
    if (!query.data || initedRef.current) return;
    initedRef.current = true;
    justAppliedServerRef.current = true;
    justAppliedPublicRef.current = true;
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

    setPublicProfile({
      display_name: typeof pub.display_name === "string" ? pub.display_name : undefined,
      avatar_color: typeof pub.avatar_color === "string" ? pub.avatar_color : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  // Push local pref changes back to the server, whole-blob, debounced.
  useEffect(() => {
    if (!initedRef.current) return;
    // Skip saving on the very render where server data was just loaded into atoms
    if (justAppliedServerRef.current) {
      justAppliedServerRef.current = false;
      return;
    }
    const prev = privateBlobRef.current;
    const unchanged =
      prev.theme === theme &&
      prev.accentColor === (accentColor ?? undefined) &&
      prev.viewMode === viewMode &&
      prev.gridSize === gridSize &&
      prev.sortField === sortField &&
      prev.sortOrder === sortOrder &&
      prev.sidebarCollapsed === sidebarCollapsed;
    privateBlobRef.current = {
      ...prev,
      theme,
      accentColor: accentColor ?? undefined,
      viewMode,
      gridSize,
      sortField,
      sortOrder,
      sidebarCollapsed,
    };
    if (unchanged) return;
    clearTimeout(privTimer.current);
    privTimer.current = setTimeout(() => {
      if (!token) return;
      const blob = privateBlobRef.current;
      withAuthRetry(token, refreshAccessToken, (tk) => updateUserInfo(tk, "private", blob))
        .then(() => patchCachedUser(userId, { private_info: blob }))
        .catch((err) => {
          console.warn("private_info save failed", err);
          showToast(err instanceof Error ? err.message : "Couldn't save your preferences", "error");
        });
    }, SAVE_DEBOUNCE_MS);
  }, [theme, accentColor, viewMode, gridSize, sortField, sortOrder, sidebarCollapsed, token, userId, refreshAccessToken]);

  useEffect(() => {
    if (!initedRef.current) return;
    // Skip saving on the very render where server data was just loaded into atoms
    if (justAppliedPublicRef.current) {
      justAppliedPublicRef.current = false;
      return;
    }
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
      const blob = publicBlobRef.current;
      withAuthRetry(token, refreshAccessToken, (tk) => updateUserInfo(tk, "public", blob))
        .then(() => patchCachedUser(userId, { public_info: blob }))
        .catch((err) => {
          console.warn("public_info save failed", err);
          showToast(err instanceof Error ? err.message : "Couldn't save your profile", "error");
        })
        .finally(() => setSavingProfile(false));
    }, SAVE_DEBOUNCE_MS);
  }, [publicProfile, token, userId, setSavingProfile, refreshAccessToken]);

  return null;
}
