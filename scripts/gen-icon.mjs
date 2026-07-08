// Regenerates all app icons from the master SVG. Run: npm run gen:icon
//
// 1. Rasterizes desktop/src-tauri/app-icon.svg -> app-icon.png at 1024x1024
//    (via @resvg/resvg-js — self-contained, no system dependencies).
// 2. Runs `tauri icon` to fan that PNG out to the committed icon set in
//    desktop/src-tauri/icons/: desktop .ico/.icns/PNGs, android/ mipmaps, ios/.
//
// app-icon.png is a throwaway intermediate (gitignored); app-icon.svg is the
// source of truth. Rebuild desktop/Android afterwards to see the new launcher icon.

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const svgPath = path.resolve(repoRoot, 'desktop/src-tauri/app-icon.svg');
const pngPath = path.resolve(repoRoot, 'desktop/src-tauri/app-icon.png');

const svg = readFileSync(svgPath, 'utf-8');
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } })
  .render()
  .asPng();
writeFileSync(pngPath, png);
console.log(`✓ Rendered ${path.relative(repoRoot, pngPath)} (1024x1024)`);

console.log('Running tauri icon ...');
const res = spawnSync(
  'npm',
  ['run', 'tauri', '-w', 'desktop', '--', 'icon', pngPath],
  { cwd: repoRoot, stdio: 'inherit', shell: true },
);
process.exit(res.status ?? 1);
