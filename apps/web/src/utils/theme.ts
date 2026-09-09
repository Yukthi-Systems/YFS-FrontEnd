export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "yfs_theme";

export const getStoredTheme = (): Theme => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private mode / blocked */
  }
  return "system";
};

const prefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export const resolveTheme = (t: Theme): "light" | "dark" =>
  t === "system" ? (prefersDark() ? "dark" : "light") : t;

// Stamp the resolved theme onto <html> — `data-theme` drives the CSS variables and
// Tailwind's `dark:` variant, `color-scheme` keeps native controls (scrollbars,
// date pickers) in step.
export const applyTheme = (t: Theme) => {
  const resolved = resolveTheme(t);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
};

export const setStoredTheme = (t: Theme) => {
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* ignore */
  }
  applyTheme(t);
};
