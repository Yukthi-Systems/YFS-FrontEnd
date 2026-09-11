import { atom, useAtom } from "jotai";
import { getStoredTheme, setStoredTheme, type Theme } from "../utils/theme";

const baseThemeAtom = atom<Theme>(getStoredTheme());

export const themeAtom = atom(
  (get) => get(baseThemeAtom),
  (_get, set, next: Theme) => {
    setStoredTheme(next);
    set(baseThemeAtom, next);
  },
);

export const useTheme = () => {
  const [theme, setTheme] = useAtom(themeAtom);
  return { theme, setTheme };
};
