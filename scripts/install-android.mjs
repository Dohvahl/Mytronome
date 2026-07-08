// Installs the freshly built Android release APK onto a connected device via adb.
// Run via `npm run deploy:android`, which builds the APK first, then runs this:
//   tauri android build --apk --target aarch64  &&  node scripts/install-android.mjs
//
// No config file: it finds adb from ANDROID_HOME/ANDROID_SDK_ROOT (or PATH) and
// the APK from the Tauri build output. Convenience only — for sideloading a debug
// device, not a release channel.

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

// The APK produced by `tauri android build --apk --target aarch64`.
const apkPath = path.resolve(
  repoRoot,
  'desktop/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk',
);

// Package id from tauri.conf.json, so the reinstall hint stays correct if it changes.
function appId() {
  try {
    const conf = JSON.parse(
      readFileSync(
        path.resolve(repoRoot, 'desktop/src-tauri/tauri.conf.json'),
        'utf-8',
      ),
    );
    return conf.identifier ?? 'ca.dovall.mytronome';
  } catch {
    return 'ca.dovall.mytronome';
  }
}

// Locate the adb executable: SDK env var first, then PATH.
function findAdb() {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb';
  if (sdk) {
    const candidate = path.join(sdk, 'platform-tools', exe);
    if (existsSync(candidate)) return candidate;
  }
  return 'adb'; // assume on PATH
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!existsSync(apkPath)) {
  fail(
    `No APK at ${apkPath}\n` +
      `Build it first: npm run deploy:android (which builds, then runs this), ` +
      `or "npm run tauri -w desktop -- android build --apk --target aarch64".`,
  );
}

const adb = findAdb();

// Require exactly the "device" state — filter out "unauthorized"/"offline" and the header.
const list = spawnSync(adb, ['devices'], { encoding: 'utf-8' });
if (list.error) {
  fail(
    `Couldn't run adb (${adb}): ${list.error.message}\n` +
      `Install platform-tools and/or set ANDROID_HOME.`,
  );
}
const devices = list.stdout
  .split('\n')
  .slice(1)
  .map((l) => l.trim())
  .filter((l) => /\tdevice$/.test(l))
  .map((l) => l.split('\t')[0]);

if (devices.length === 0) {
  fail(
    'No authorized device connected. Plug in your phone with USB debugging on ' +
      '(accept the "Allow USB debugging?" prompt), then re-run. Check with: adb devices',
  );
}
if (devices.length > 1) {
  console.log(
    `Multiple devices (${devices.join(', ')}); installing on the first: ${devices[0]}`,
  );
}
const serial = devices[0];

console.log(`Installing ${path.basename(apkPath)} -> ${serial} ...`);
const install = spawnSync(adb, ['-s', serial, 'install', '-r', apkPath], {
  stdio: 'inherit',
});

if (install.status !== 0) {
  console.error(
    `\nInstall failed. If it was a signature mismatch ` +
      `(INSTALL_FAILED_UPDATE_INCOMPATIBLE), uninstall the old copy and retry:\n` +
      `  ${path.basename(adb)} -s ${serial} uninstall ${appId()}\n` +
      `  npm run deploy:android`,
  );
  process.exit(install.status ?? 1);
}
console.log('✓ Installed.');
