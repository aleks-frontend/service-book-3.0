import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

/**
 * Where the chosen theme is remembered. `index.html` reads the same key in an
 * inline script, so the page is painted in the right theme before the app loads.
 */
const THEME_STORAGE_KEY = "servicebook-theme";

const listeners = new Set<() => void>();

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  listeners.forEach((listener) => listener());
}

function hasSavedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Switches the theme and remembers the choice for the next visit. */
export function changeTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the switch still applies to this visit.
  }
  applyTheme(theme);
}

// Until a theme is chosen, follow the OS as it switches between light and dark.
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
prefersDark.addEventListener("change", (event) => {
  if (!hasSavedTheme()) applyTheme(event.matches ? "dark" : "light");
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The theme on screen, kept current as it changes. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme);
}
