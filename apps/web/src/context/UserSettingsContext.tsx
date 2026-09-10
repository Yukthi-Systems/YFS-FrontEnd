import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getUserById, updateUserInfo } from "@yfs/service";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import type { SortField, SortOrder, ViewMode } from "../types/file";
import type { Theme } from "../utils/theme";

// Server-backed per-user settings, split across the two `users` blobs YFS-Main-API
// exposes on GET /user/user-by-id/{self}:
//   - private_info: UI preferences, visible only to the user (theme, view mode, …)
//   - public_info:  profile fields the whole org can see (display name, avatar colour)
// Both are written back wholesale via PATCH /user/update-user-info/{isPublic}, so we
// keep the full blob in a ref and merge patches into it before saving (debounced).

const SAVE_DEBOUNCE_MS = 700;

const THEMES: Theme[] = ["light", "dark", "system"];
const VIEW_MODES: ViewMode[] = ["list", "grid"];
const SORT_FIELDS: SortField[] = ["name", "modifiedAt", "size"];
const SORT_ORDERS: SortOrder[] = ["asc", "desc"];

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

interface PrivateBlob {
  theme?: Theme;
  viewMode?: ViewMode;
  sortField?: SortField;
  sortOrder?: SortOrder;
  sidebarCollapsed?: boolean;
  [k: string]: unknown; // preserve keys we don't model
}

interface UserSettingsContextType {
  loaded: boolean;

  // View preferences — seeded from private_info once loaded, written through on change.
  viewMode: ViewMode;
  sortField: SortField;
  sortOrder: SortOrder;
  sidebarCollapsed: boolean;
  setViewMode: (v: ViewMode) => void;
  setSortField: (v: SortField) => void;
  setSortOrder: (v: SortOrder) => void;
  setSidebarCollapsed: (v: boolean) => void;

  // Theme lives in ThemeContext (it's applied pre-paint from localStorage); these
  // let ThemeSettingsBridge reconcile it with private_info.
  serverTheme: Theme | undefined;
  persistTheme: (t: Theme) => void;

  // Public profile.
  publicProfile: PublicProfile;
  savePublicProfile: (patch: PublicProfile) => void;
  savingProfile: boolean;
}

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

const oneOf = <T,>(allowed: readonly T[], v: unknown): T | undefined =>
  allowed.includes(v as T) ? (v as T) : undefined;

export const UserSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, userId } = useAuth();

  const [loaded, setLoaded] = useState(false);
  const [viewMode, setViewModeState] = useState<ViewMode>("list");
  const [sortField, setSortFieldState] = useState<SortField>("name");
  const [sortOrder, setSortOrderState] = useState<SortOrder>("asc");
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [serverTheme, setServerTheme] = useState<Theme | undefined>(undefined);
  const [publicProfile, setPublicProfile] = useState<PublicProfile>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const authRef = useRef({ token, userId });
  authRef.current = { token, userId };

  const privateRef = useRef<PrivateBlob>({});
  const publicRef = useRef<Record<string, unknown>>({});
  const privTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pubTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load both blobs for the signed-in user.
  useEffect(() => {
    if (!token || !userId) {
      setLoaded(false);
      privateRef.current = {};
      publicRef.current = {};
      return;
    }
    let cancelled = false;
    getUserById(token, userId)
      .then((u) => {
        if (cancelled || !u) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const priv = (u.private_info ?? {}) as PrivateBlob;
        const pub = (u.public_info ?? {}) as Record<string, unknown>;
        privateRef.current = { ...priv };
        publicRef.current = { ...pub };

        const vm = oneOf(VIEW_MODES, priv.viewMode);
        const sf = oneOf(SORT_FIELDS, priv.sortField);
        const so = oneOf(SORT_ORDERS, priv.sortOrder);
        const th = oneOf(THEMES, priv.theme);
        if (vm) setViewModeState(vm);
        if (sf) setSortFieldState(sf);
        if (so) setSortOrderState(so);
        if (typeof priv.sidebarCollapsed === "boolean") setSidebarCollapsedState(priv.sidebarCollapsed);
        if (th) setServerTheme(th);
        setPublicProfile({
          display_name: typeof pub.display_name === "string" ? pub.display_name : undefined,
          avatar_color: typeof pub.avatar_color === "string" ? pub.avatar_color : undefined,
        });
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true); // keep defaults; prefs just won't sync this session
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  const flushPrivate = useCallback(() => {
    clearTimeout(privTimer.current);
    privTimer.current = setTimeout(() => {
      const { token: tk } = authRef.current;
      if (!tk) return;
      updateUserInfo(tk, "private", privateRef.current).catch((err) =>
        console.warn("private_info save failed", err)
      );
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const patchPrivate = useCallback(
    (patch: Partial<PrivateBlob>) => {
      privateRef.current = { ...privateRef.current, ...patch };
      flushPrivate();
    },
    [flushPrivate]
  );

  const setViewMode = useCallback(
    (v: ViewMode) => {
      setViewModeState(v);
      patchPrivate({ viewMode: v });
    },
    [patchPrivate]
  );
  const setSortField = useCallback(
    (v: SortField) => {
      setSortFieldState(v);
      patchPrivate({ sortField: v });
    },
    [patchPrivate]
  );
  const setSortOrder = useCallback(
    (v: SortOrder) => {
      setSortOrderState(v);
      patchPrivate({ sortOrder: v });
    },
    [patchPrivate]
  );
  const setSidebarCollapsed = useCallback(
    (v: boolean) => {
      setSidebarCollapsedState(v);
      patchPrivate({ sidebarCollapsed: v });
    },
    [patchPrivate]
  );
  const persistTheme = useCallback(
    (t: Theme) => {
      setServerTheme(t);
      patchPrivate({ theme: t });
    },
    [patchPrivate]
  );

  const savePublicProfile = useCallback((patch: PublicProfile) => {
    publicRef.current = { ...publicRef.current, ...patch };
    setPublicProfile((p) => ({ ...p, ...patch }));
    setSavingProfile(true);
    clearTimeout(pubTimer.current);
    pubTimer.current = setTimeout(() => {
      const { token: tk } = authRef.current;
      if (!tk) {
        setSavingProfile(false);
        return;
      }
      updateUserInfo(tk, "public", publicRef.current)
        .catch((err) => console.warn("public_info save failed", err))
        .finally(() => setSavingProfile(false));
    }, SAVE_DEBOUNCE_MS);
  }, []);

  return (
    <UserSettingsContext.Provider
      value={{
        loaded,
        viewMode,
        sortField,
        sortOrder,
        sidebarCollapsed,
        setViewMode,
        setSortField,
        setSortOrder,
        setSidebarCollapsed,
        serverTheme,
        persistTheme,
        publicProfile,
        savePublicProfile,
        savingProfile,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
};

export const useUserSettings = () => {
  const ctx = useContext(UserSettingsContext);
  if (!ctx) throw new Error("useUserSettings must be used within a UserSettingsProvider");
  return ctx;
};

// Reconciles ThemeContext (localStorage, applied pre-paint) with the server copy in
// private_info: on first load push the server value into ThemeContext; after that,
// push local theme changes back to the server. Render once inside both providers.
export const ThemeSettingsBridge: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { loaded, serverTheme, persistTheme } = useUserSettings();
  const initedRef = useRef(false);

  // Re-arm the one-time server->client apply across a logout/login.
  useEffect(() => {
    if (!loaded) initedRef.current = false;
  }, [loaded]);

  useEffect(() => {
    if (!loaded || initedRef.current) return;
    initedRef.current = true;
    if (serverTheme && serverTheme !== theme) setTheme(serverTheme);
  }, [loaded, serverTheme, theme, setTheme]);

  useEffect(() => {
    if (!initedRef.current) return;
    if (theme !== serverTheme) persistTheme(theme);
  }, [theme, serverTheme, persistTheme]);

  return null;
};
