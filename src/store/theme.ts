import { atom } from "jotai";

// Initialize from localStorage or prefers-color-scheme
const getInitialTheme = (): "light" | "dark" => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved) return saved;
    const preference = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    return preference;
  }
  return "light";
};

export const themeAtom = atom<"light" | "dark">(getInitialTheme());

export const toggleThemeAtom = atom(
  (get) => get(themeAtom),
  (get, set) => {
    const current = get(themeAtom);
    const next = current === "light" ? "dark" : "light";
    set(themeAtom, next);
    localStorage.setItem("theme", next);

    // Apply class to documentElement
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  },
);
