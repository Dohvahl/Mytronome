import { useEffect, useState } from 'react';
import { THEMES, DEFAULT_THEME, type ThemeId } from './themes';

const STORAGE_KEY = 'mytronome.theme';

/** The saved theme id, or the default if none is saved / it's no longer valid. */
export function readSavedTheme(): ThemeId {
  const saved = localStorage.getItem(STORAGE_KEY);
  return THEMES.some((t) => t.id === saved) ? (saved as ThemeId) : DEFAULT_THEME;
}

/** Apply a theme by setting `data-theme` on <html>; the CSS variables do the rest. */
export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
}

/**
 * Current visual theme, persisted to localStorage (same pattern as the app's
 * other UI prefs). Setting it swaps `data-theme` on <html>, which switches the
 * CSS-variable palette defined in index.css / themes.css.
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(readSavedTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return { theme, setTheme, themes: THEMES };
}
