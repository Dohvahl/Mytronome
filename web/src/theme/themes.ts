// A theme is just a set of CSS-variable values applied via `data-theme` on
// <html>. The actual values live in CSS: the default "studio" look in index.css
// (`:root`), and the alternates in themes.css (`[data-theme='...']`). This file
// is only the registry the picker maps over.
//
// To add a theme: add a block to themes.css and an entry here.

export interface Theme {
  id: string;
  /** Label shown in the picker. */
  name: string;
}

export const THEMES: Theme[] = [
  { id: 'studio', name: 'Studio' }, // the default; respects OS light/dark
  { id: 'walnut', name: 'Walnut & Brass' },
  { id: 'onyx', name: 'Onyx & Silver' },
];

export type ThemeId = string;

export const DEFAULT_THEME: ThemeId = 'studio';
