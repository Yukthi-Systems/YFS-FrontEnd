import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { themeAtom } from "../atoms/theme";
import { applyTheme } from "../utils/theme";

// Applies the current theme to <html> and follows OS changes while on "system".
// Mounted once at the app root, outside any route branch.
export function ThemeEffect() {
  const theme = useAtomValue(themeAtom);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return null;
}
