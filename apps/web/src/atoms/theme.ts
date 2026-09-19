import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Theme } from "../utils/theme";

// Raw strings in localStorage, not JSON-encoded — index.html's pre-paint script reads
// "yfs_theme" directly (before React/jotai exist) to set data-theme ahead of first
// paint, so this can't switch to atomWithStorage's default JSON serialization.
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

// getOnInit: true matters here — atomWithStorage otherwise defaults to the initial
// value on first read and only hydrates from storage after mount (same gotcha as
// atoms/auth.ts's tokenAtom), which would flash the wrong theme/accent on load.
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
