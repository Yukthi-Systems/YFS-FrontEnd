export type Theme = "light" | "dark" | "system";

const prefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export const resolveTheme = (t: Theme): "light" | "dark" =>
  t === "system" ? (prefersDark() ? "dark" : "light") : t;

// Stamp the resolved theme onto <html> — `data-theme` drives the CSS variables and
// Tailwind's `dark:` variant, `color-scheme` keeps native controls (scrollbars,
// date pickers) in step. Persistence lives on the atom (atoms/theme.ts); this is
// DOM application only, run from ThemeEffect whenever that atom changes.
export const applyTheme = (t: Theme) => {
  const resolved = resolveTheme(t);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
};

const hexToRgba = (hex: string, alpha: number): string => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Overrides the light/dark theme's built-in --accent with a user-chosen color;
// null restores the per-theme default defined in index.css. --accent-bg/-border are
// derived from it (same alphas index.css uses) since nothing else computes those.
export const applyAccentColor = (color: string | null) => {
  const root = document.documentElement.style;
  if (!color) {
    root.removeProperty("--accent");
    root.removeProperty("--accent-bg");
    root.removeProperty("--accent-border");
    return;
  }
  root.setProperty("--accent", color);
  root.setProperty("--accent-bg", hexToRgba(color, 0.15));
  root.setProperty("--accent-border", hexToRgba(color, 0.5));
};
