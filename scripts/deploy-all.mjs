// The full ship: version bump, tests, then every platform built and released.
//
//   npm run deploy:all -- --minor    bump the minor version, then ship
//   npm run deploy:all               ship the CURRENT version (retry a failed run)
//   npm run deploy:all -- --patch --skip-tests
//
// It runs the individual `deploy:*` scripts rather than reimplementing them, so
// there is still exactly one definition of "deploy the web app" and you can run
// any single step on its own.
//
// Order and why:
//   1. preflight   — every check that can fail cheaply, before anything ships
//   2. bump        — the version is compiled into the desktop and Android
//                    binaries, so it must be set before they build
//   3. tests
//   4. web         — build + SFTP to the static host
//   5. desktop     — installers for this platform
//   6. android     — signed AAB for Play
//   7. release     — a GitHub release on the tag, with the binaries attached
//
// bumpVersion.mjs commits, tags and pushes as part of step 2, so a build that
// fails afterwards leaves a pushed tag with no release. Re-run without a bump
// level to pick up from there — `gh release create` works on the existing tag.
//
// What this does NOT do: upload to Google Play. That needs the Play Console UI
// (or a service account and the publishing API). The AAB is attached to the
// GitHub release and its path is printed for you to upload by hand.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const argv = process.argv.slice(2);
const skipTests = argv.includes('--skip-tests');
// Anything bumpVersion.mjs understands: a level flag or an explicit x.y.z.
const bumpArg = argv.find(
  (a) => /^--(major|minor|patch)$/.test(a) || /^\d+\.\d+\.\d+$/.test(a),
);

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/**
 * Run a command, inheriting stdio. Exits the whole deploy if it fails.
 *
 * `shell` is a per-call decision, not a default, because the two concerns pull
 * opposite ways. With a shell, arguments are concatenated into a command line
 * instead of passed as argv, so anything containing a space has to be quoted by
 * hand (Node's DEP0190 warning). Without one, Node refuses to spawn a .cmd or
 * .bat at all — it was a command-injection vector (CVE-2024-27980) — and npm on
 * Windows is exactly that.
 *
 * So: npm gets a shell, and every npm argument here is a literal script name
 * with no path and no space in it. git, gh and node are real executables that
 * spawn fine without one, which is what lets the release step pass file paths
 * as plain argv.
 */
function run(label, cmd, args, { shell = false } = {}) {
  console.log(`\n──── ${label} ────`);
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell,
  });
  // A command that never started reports status null, not a failure code —
  // report the spawn error rather than a bare "failed" with nothing above it.
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    fail(
      `${label} failed (exit ${result.status}). Nothing after this step ran.`,
    );
  }
}

/** `npm run <script>` — see `run` for why this one needs a shell. */
function runNpm(label, args) {
  run(label, 'npm', args, { shell: true });
}

/** Run a command quietly and return its trimmed stdout ('' if it failed). */
function capture(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: repoRoot, encoding: 'utf-8' });
  return r.status === 0 ? (r.stdout ?? '').trim() : '';
}

function readVersion() {
  const text = readFileSync(path.join(repoRoot, 'package.json'), 'utf-8');
  const m = text.match(/"version":\s*"(\d+\.\d+\.\d+)"/);
  if (!m) fail('Could not read the version from package.json.');
  return m[1];
}

/** Every file under `dir` whose name matches, recursively. [] if dir is absent. */
function findFiles(dir, matches) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...findFiles(full, matches));
    else if (matches(entry)) found.push(full);
  }
  return found;
}

// ── 1. Preflight ────────────────────────────────────────────────────────────
// Everything that can fail without side effects, checked before the first build.
console.log('Preflight ...');

if (capture('git', ['status', '--porcelain']) !== '') {
  fail(
    'Working tree is dirty. The version bump commits specific files, so commit ' +
      'or stash everything else first.\n  git status',
  );
}

if (capture('gh', ['--version']) === '') {
  fail(
    'The GitHub CLI (gh) is not installed or not on PATH — needed to publish ' +
      'the release. https://cli.github.com',
  );
}
if (spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' }).status !== 0) {
  fail('gh is not authenticated. Run: gh auth login');
}

if (!existsSync(path.join(here, 'deploy-web.config.json'))) {
  fail(
    'Missing scripts/deploy-web.config.json (SFTP credentials for the web host).',
  );
}

// An unsigned AAB is rejected by Play, and the Android build won't say so.
const keystoreProps = path.join(
  repoRoot,
  'desktop/src-tauri/gen/android/keystore.properties',
);
if (!existsSync(keystoreProps)) {
  fail(
    `Missing ${path.relative(repoRoot, keystoreProps)} — the release AAB would be ` +
      'unsigned and Play would reject it.\nSee desktop/README.md → "Android release signing".',
  );
}

console.log('✓ Preflight passed.');

// ── 2. Version ──────────────────────────────────────────────────────────────
// Baked into the desktop and Android binaries, so it has to happen before they
// build. bumpVersion.mjs prompts before it commits, tags and pushes.
if (bumpArg) {
  run('Version bump', 'node', ['scripts/bumpVersion.mjs', bumpArg]);
} else {
  console.log('\nNo bump level given — shipping the current version as-is.');
}
const version = readVersion();
const tag = `v${version}`;
console.log(`\nShipping ${tag}`);

// ── 3. Tests ────────────────────────────────────────────────────────────────
if (skipTests) console.log('\nSkipping tests (--skip-tests).');
else runNpm('Tests', ['test']);

// ── 4-6. Build and deploy each platform ─────────────────────────────────────
// Each Tauri build re-runs the web build itself (tauri.conf.json's
// beforeBuildCommand), which is a second or two and keeps the bundled web app
// guaranteed identical to the one just uploaded.
runNpm('Web (build + SFTP)', ['run', 'deploy:web']);
runNpm('Desktop installers', ['run', 'deploy:desktop']);
runNpm('Android AAB', ['run', 'deploy:android:aab']);

// ── 7. GitHub release ───────────────────────────────────────────────────────
const bundleDir = path.join(
  repoRoot,
  'desktop/src-tauri/target/release/bundle',
);
const androidOutputs = path.join(
  repoRoot,
  'desktop/src-tauri/gen/android/app/build/outputs/bundle',
);

// The bundle directory is never cleaned, so it holds an installer for every
// version ever built on this machine. Tauri stamps the version into each name
// (`Mytronome_1.3.1_x64-setup.exe`, `mytronome_1.3.1_amd64.deb`), and matching
// on that is what keeps four old releases from being attached to this one.
//
// Deliberately not an mtime cutoff: re-running without a bump to recover from a
// failed step is a supported path, and there the artifacts are correct but were
// written by the earlier run.
const versionTag = `_${version}_`;

const artifacts = [
  // Installer formats across the three desktop platforms — only this machine's
  // will exist, the rest come from a build on that OS.
  ...findFiles(
    bundleDir,
    (f) =>
      /\.(exe|msi|dmg|deb|rpm|AppImage)$/i.test(f) && f.includes(versionTag),
  ),
  // The AAB name carries no version, but Gradle writes exactly one and
  // overwrites it on every build, so whatever is there belongs to this version.
  ...findFiles(androidOutputs, (f) => f.endsWith('.aab')),
];

if (artifacts.length === 0) {
  fail(
    `Every build reported success but no artifacts for ${version} were found.\n` +
      `Looked for names containing "${versionTag}" in ` +
      `${path.relative(repoRoot, bundleDir)}, and an .aab in ` +
      `${path.relative(repoRoot, androidOutputs)}.`,
  );
}

console.log('\nArtifacts:');
for (const f of artifacts) console.log(`  ${path.relative(repoRoot, f)}`);

// A re-run lands on an existing release; upload --clobber replaces the files
// rather than erroring on the duplicate.
const releaseExists =
  spawnSync('gh', ['release', 'view', tag], {
    cwd: repoRoot,
    stdio: 'ignore',
  }).status === 0;

if (releaseExists) {
  console.log(`\nRelease ${tag} already exists — replacing its assets.`);
  run('GitHub release (upload)', 'gh', [
    'release',
    'upload',
    tag,
    ...artifacts,
    '--clobber',
  ]);
} else {
  run('GitHub release (create)', 'gh', [
    'release',
    'create',
    tag,
    ...artifacts,
    '--title',
    tag,
    '--generate-notes',
  ]);
}

// ── Done ────────────────────────────────────────────────────────────────────
const aab = artifacts.find((f) => f.endsWith('.aab'));
console.log(`\n✓ Shipped ${tag}`);
console.log('  web      → live on the static host');
console.log(`  desktop  → installers attached to the ${tag} release`);
console.log(
  `  android  → ${aab ? path.relative(repoRoot, aab) : 'no AAB found'}`,
);
console.log(
  '\nStill manual: upload the AAB in the Play Console (Production → Create new release).',
);
