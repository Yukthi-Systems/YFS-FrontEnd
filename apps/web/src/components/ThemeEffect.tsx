import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { themeAtom, accentColorAtom } from "../atoms/theme";
import { applyTheme, applyAccentColor } from "../utils/theme";

// Applies the current theme (and any accent color override) to <html>, and follows
// OS changes while on "system". Mounted once at the app root, outside any route branch.
export function ThemeEffect() {
  const theme = useAtomValue(themeAtom);
  const accentColor = useAtomValue(accentColorAtom);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    applyAccentColor(accentColor);
  }, [accentColor]);

  return null;
}
