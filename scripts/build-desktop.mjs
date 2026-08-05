// Builds the Tauri desktop installers for THIS machine's platform.
// Run via `npm run deploy:desktop`, or as one step of `npm run deploy:all`.
//
// Tauri can only bundle for the OS it runs on — there is no cross-compilation —
// so a Windows machine produces .exe/.msi only. Mac and Linux installers need a
// build on those platforms (or CI).
//
// The Google Drive credentials are baked in at compile time via `option_env!`,
// so they must be in the environment before `tauri build` runs. Two ways in:
//
//   1. scripts/buildDesktopApp.bat — the gitignored local builder that sets them
//      and calls tauri itself. Preferred on Windows: one place holds the secret.
//   2. MYTRONOME_GOOGLE_CLIENT_ID / _SECRET already exported in the environment.
//
// With neither, the build still succeeds — Drive just compiles as
// "unconfigured" and its Connect button never appears. That's a silent
// downgrade in a shipped binary, so it stops here instead.

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const wrapper = path.join(here, 'buildDesktopApp.bat');

const hasEnvCreds = Boolean(
  process.env.MYTRONOME_GOOGLE_CLIENT_ID &&
  process.env.MYTRONOME_GOOGLE_CLIENT_SECRET,
);
const hasWrapper = process.platform === 'win32' && existsSync(wrapper);

if (!hasEnvCreds && !hasWrapper) {
  console.error(
    'No Google Drive credentials for the desktop build.\n' +
      (process.platform === 'win32'
        ? `Expected ${wrapper} (gitignored — see desktop/README.md), or\n`
        : '') +
      'export MYTRONOME_GOOGLE_CLIENT_ID and MYTRONOME_GOOGLE_CLIENT_SECRET.\n' +
      'Without them Drive compiles as unconfigured and the Connect button is hidden.',
  );
  process.exit(1);
}

// The wrapper sets the credentials itself, so prefer it when the environment
// doesn't already carry them.
const [cmd, args] = hasEnvCreds
  ? ['npm', ['run', 'tauri', '-w', 'desktop', '--', 'build']]
  : [wrapper, []];

console.log(
  `Building desktop bundles for ${process.platform} via ${path.basename(cmd)} ...`,
);
const build = spawnSync(cmd, args, {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true, // npm and .bat both need a shell on Windows
});

if (build.status !== 0) process.exit(build.status ?? 1);
console.log('✓ Desktop bundles built.');
