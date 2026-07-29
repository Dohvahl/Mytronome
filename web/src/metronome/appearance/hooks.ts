import { useLayoutEffect, useState } from 'react';
import { DEFAULT_ACCENT, onAccent, usableAccent } from './accent';

/** Light/dark/system theme choice. */
export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_KEY = 'theme';
const THEMES: readonly ThemeMode[] = ['system', 'light', 'dark'];
const ACCENT_KEY = 'accent';

/**
 * The theme choice, persisted and mirrored onto `<html data-theme>`. For
 * `system` the attribute is REMOVED so the `prefers-color-scheme` media query
 * governs; an explicit `light`/`dark` sets it and wins over the OS.
 */
export function useTheme(): [ThemeMode, (mode: ThemeMode) => void] {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    return saved && THEMES.includes(saved) ? saved : 'system';
  });

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return [theme, setTheme];
}

/**
 * The free-chosen accent colour, persisted and applied as inline custom
 * properties on `<html>`: `--accent` (clamped for legibility against the active
 * theme's background) and `--accent-contrast` (black/white for text on it).
 * Takes the current theme so it can resolve the effective light/dark background,
 * and re-clamps when the OS scheme flips while on `system`.
 */
export function useAccent(theme: ThemeMode): [string, (hex: string) => void] {
  const [accent, setAccent] = useState<string>(
    () => localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT,
  );

  useLayoutEffect(() => {
    localStorage.setItem(ACCENT_KEY, accent);

    const apply = () => {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      const applied = usableAccent(accent, isDark);
      const root = document.documentElement;
      root.style.setProperty('--accent', applied);
      root.style.setProperty('--accent-contrast', onAccent(applied));
    };
    apply();

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [accent, theme]);

  return [accent, setAccent];
}
