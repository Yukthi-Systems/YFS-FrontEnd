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

export type Theme = "light" | "dark" | "system";

const prefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export const resolveTheme = (t: Theme): "light" | "dark" =>
  t === "system" ? (prefersDark() ? "dark" : "light") : t;

// `data-theme` drives the CSS variables; `color-scheme` keeps native controls in step.
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

// null restores the theme default; -bg/-border use the same alphas as index.css.
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
