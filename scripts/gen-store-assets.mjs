// Renders the Play Store graphics that can be built from the logo.
// Run: npm run gen:store   →   play-store/icon-512.png, feature-graphic.png
//
// Screenshots are NOT here — Play wants real captures of the running app, which
// needs a device or emulator. See play-store/listing.md for the shot list.
//
// Both assets are committed rather than gitignored: they're what was uploaded
// to the Console, so they should be diffable when the branding changes.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const outDir = path.join(repoRoot, 'play-store');
mkdirSync(outDir, { recursive: true });

// The same three colours as app-icon.svg — keep them in step by hand; the SVG
// is the source of truth for the mark itself.
const INK = '#26221d';
const INK_DEEP = '#1a1815';
const CREAM = '#efe7d5';
const BRASS = '#c99a5b';

function render(svg, width, file, height) {
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    // resvg has no default font of its own; without a real family the text
    // silently renders as nothing.
    font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' },
  })
    .render()
    .asPng();
  const full = path.join(outDir, file);
  writeFileSync(full, png);
  console.log(
    `✓ ${path.relative(repoRoot, full)} (${width}x${height ?? width}, ${Math.round(png.length / 1024)} KB)`,
  );
}

// --- 1. App icon: 512x512 ---------------------------------------------------
// Straight from the master SVG, which already paints an opaque background —
// Play rejects transparency in the icon.
render(
  readFileSync(path.join(repoRoot, 'desktop/src-tauri/app-icon.svg'), 'utf-8'),
  512,
  'icon-512.png',
);

// --- 2. Feature graphic: 1024x500 -------------------------------------------
// The mark on the left, wordmark and one line of positioning on the right.
// Play crops this differently across surfaces and may overlay a play button in
// the middle, so everything sits clear of the centre and the outer ~80px.
const featureGraphic = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK}"/>
      <stop offset="1" stop-color="${INK_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>

  <!-- A faint tempo scale along the bottom, echoing the slider's tick marks. -->
  <g stroke="${CREAM}" stroke-opacity="0.10" stroke-width="2">
    ${Array.from({ length: 33 }, (_, i) => {
      const x = 96 + i * 26;
      const tall = i % 4 === 0;
      return `<line x1="${x}" y1="${tall ? 436 : 444}" x2="${x}" y2="452"/>`;
    }).join('\n    ')}
  </g>

  <!-- The mark, scaled from app-icon.svg's 100x100 space. The background rect
       is dropped so it sits on the gradient instead of a hard square. -->
  <g transform="translate(112 104) scale(2.6)">
    <g fill="none" stroke-linecap="round">
      <line x1="22" y1="80" x2="29" y2="24" stroke="${CREAM}" stroke-width="7"/>
      <line x1="78" y1="80" x2="71" y2="24" stroke="${CREAM}" stroke-width="7"/>
      <line x1="50" y1="79" x2="57" y2="25" stroke="${BRASS}" stroke-width="6"/>
    </g>
    <rect x="46.5" y="45" width="15" height="8" rx="2.5" fill="${BRASS}" transform="rotate(7 54 49)"/>
    <circle cx="50" cy="79" r="4" fill="${CREAM}"/>
  </g>

  <text x="430" y="242" font-family="Segoe UI, Arial, sans-serif" font-size="88"
        font-weight="700" fill="${CREAM}" letter-spacing="-2">Mytronome</text>
  <text x="433" y="298" font-family="Segoe UI, Arial, sans-serif" font-size="31"
        fill="${BRASS}">A metronome built for practising</text>
</svg>`;

render(featureGraphic, 1024, 'feature-graphic.png', 500);
