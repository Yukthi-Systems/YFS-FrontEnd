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

import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Theme } from "../utils/theme";

// Raw strings, not JSON: index.html's pre-paint script reads "yfs_theme" directly.
const rawStringStorage = <T extends string>(isValid: (v: string) => v is T) => ({
  getItem: (key: string, initialValue: T): T => {
    try {
      const v = localStorage.getItem(key);
      if (v !== null && isValid(v)) return v;
    } catch {
      /* private mode / blocked */
    }
    return initialValue;
  },
  setItem: (key: string, value: T) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
});

const isTheme = (v: string): v is Theme => v === "light" || v === "dark" || v === "system";

// getOnInit avoids a wrong-theme flash on load.
export const themeAtom = atomWithStorage<Theme>("yfs_theme", "system", rawStringStorage(isTheme), { getOnInit: true });

export const useTheme = () => {
  const [theme, setTheme] = useAtom(themeAtom);
  return { theme, setTheme };
};

const accentColorStorage = {
  getItem: (key: string, initialValue: string | null): string | null => {
    try {
      const v = localStorage.getItem(key);
      if (v !== null && /^#[0-9a-f]{6}$/i.test(v)) return v;
    } catch {
      /* private mode / blocked */
    }
    return initialValue;
  },
  setItem: (key: string, value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

// null = no override, use the light/dark theme's built-in accent (see index.css).
export const accentColorAtom = atomWithStorage<string | null>("yfs_accent_color", null, accentColorStorage, {
  getOnInit: true,
});

export const useAccentColor = () => {
  const [accentColor, setAccentColor] = useAtom(accentColorAtom);
  return { accentColor, setAccentColor };
};
