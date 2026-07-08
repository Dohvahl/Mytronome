// Pure colour helpers for the user-chosen accent. No DOM — unit-tested in
// web/test/accent.test.ts. The accent is a free-picked colour, so these keep it
// legible: usableAccent() nudges it into a readable range for the active theme,
// and onAccent() picks black/white text for sitting on top of it.

export const DEFAULT_ACCENT = '#b8935a'; // brass, matching the logo

interface Rgb {
  r: number;
  g: number;
  b: number;
}

// --bg values from index.css, so contrast is measured against the real surface.
const LIGHT_BG: Rgb = { r: 255, g: 255, b: 255 };
const DARK_BG: Rgb = { r: 22, g: 23, b: 29 };

// Accent is used for emphasis/borders/icons and some text; 3:1 is the WCAG AA
// threshold for UI components and large text — enough to stay legible without
// over-muting vivid picks.
const MIN_CONTRAST = 3;

export function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** WCAG relative luminance, 0 (black) … 1 (white). */
export function luminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours, 1 … 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white — whichever is more readable as text on the given colour. */
export function onAccent(hex: string): string {
  const rgb = hexToRgb(hex);
  return contrast(rgb, { r: 255, g: 255, b: 255 }) >=
    contrast(rgb, { r: 0, g: 0, b: 0 })
    ? '#ffffff'
    : '#000000';
}

/**
 * Return the accent unchanged if it already meets MIN_CONTRAST against the
 * theme background; otherwise blend it toward white (dark theme) or black
 * (light theme) in small steps until it does. Keeps legible picks intact and
 * only nudges problematic ones.
 */
export function usableAccent(hex: string, isDark: boolean): string {
  const bg = isDark ? DARK_BG : LIGHT_BG;
  const rgb = hexToRgb(hex);
  if (contrast(rgb, bg) >= MIN_CONTRAST) return rgbToHex(rgb);

  const toward = isDark ? 255 : 0;
  for (let t = 0.05; t <= 1; t += 0.05) {
    const mixed: Rgb = {
      r: rgb.r + (toward - rgb.r) * t,
      g: rgb.g + (toward - rgb.g) * t,
      b: rgb.b + (toward - rgb.b) * t,
    };
    if (contrast(mixed, bg) >= MIN_CONTRAST) return rgbToHex(mixed);
  }
  return rgbToHex({ r: toward, g: toward, b: toward });
}
