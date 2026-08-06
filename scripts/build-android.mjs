// Builds the signed Android App Bundle.
// Run via `npm run deploy:android:aab`, or as one step of `npm run deploy:all`.
//
//   npm run deploy:android:aab                 ship build (default)
//   npm run deploy:android:aab -- --symbols    + native debug info (SEE BELOW)
//
// --- Native debug symbols: opt-in, and currently NOT WORKING ---------------
//
// Play symbolicates native crashes out of the Rust shell only if the bundle
// carries debug symbols for the .so files, which needs two halves:
//
//   1. Cargo has to EMIT debug info      — `--symbols` here.
//   2. AGP has to STRIP the shipped .so and pack the symbols into the bundle
//      — `ndk.debugSymbolLevel` in gen/android/app/build.gradle.kts.
//
// Half 2 does not work in this project and the cause is not yet found. AGP's
// stripUniversalReleaseDebugSymbols runs, emits no warning, and produces output
// byte-identical to its input; native_debug_metadata stays empty. Setting
// `ndkVersion` did not change it.
//
// So `--symbols` on its own is a pure regression — the unstripped libraries go
// out at roughly 60 MB per ABI instead of ~15 MB, and no symbols are produced.
// It stays off until half 2 is fixed. See desktop/README.md → "Native debug
// symbols" for the diagnosis so far.
//
// Why an env var rather than `[profile.release]` in Cargo.toml: profiles are
// global, so a debug=1 there would also fatten every Windows/macOS/Linux
// desktop binary. `1` is line tables — function names and line numbers, without
// the variable info that makes full Rust DWARF enormous.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const withSymbols = process.argv.slice(2).includes('--symbols');

console.log(
  withSymbols
    ? 'Building the release AAB WITH native debug info (known broken — see header) ...'
    : 'Building the release AAB ...',
);

// npm is a .cmd shim on Windows and Node won't spawn one without a shell
// (CVE-2024-27980). Every argument here is a literal, so there's nothing for
// the shell to mis-split.
const build = spawnSync(
  'npm',
  ['run', 'tauri', '-w', 'desktop', '--', 'android', 'build', '--aab'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
    env: withSymbols
      ? { ...process.env, CARGO_PROFILE_RELEASE_DEBUG: '1' }
      : process.env,
  },
);

if (build.error) {
  console.error(`Couldn't start the Android build: ${build.error.message}`);
  process.exit(1);
}
if (build.status !== 0) process.exit(build.status ?? 1);

console.log('✓ AAB built.');
