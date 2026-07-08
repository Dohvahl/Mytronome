// Bumps the app version across all 7 places it lives — reading the CURRENT
// version from the root package.json, so you never have to look it up.
//
// Usage:
//   node scripts/bumpVersion.mjs --patch   (or -p)    1.0.0 -> 1.0.1
//   node scripts/bumpVersion.mjs --minor   (or -m)    1.0.0 -> 1.1.0
//   node scripts/bumpVersion.mjs --major   (or -M)    1.0.0 -> 2.0.0
//   node scripts/bumpVersion.mjs 2.3.1                (explicit, for jumps)
// or via npm:  npm run bump:patch | bump:minor | bump:major

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const LEVELS = {
  '--major': 'major',
  '-M': 'major',
  '--minor': 'minor',
  '-m': 'minor',
  '--patch': 'patch',
  '-p': 'patch',
};

function currentVersion() {
  const text = readFileSync(path.join(root, 'package.json'), 'utf-8');
  const m = text.match(/"version":\s*"(\d+)\.(\d+)\.(\d+)"/);
  if (!m) {
    console.error('Could not read the current version from package.json.');
    process.exit(1);
  }
  return m.slice(1, 4).map(Number); // [major, minor, patch]
}

const arg = process.argv[2];
const current = currentVersion().join('.');
let next;

if (LEVELS[arg]) {
  let [maj, min, pat] = currentVersion();
  if (LEVELS[arg] === 'major') ((maj += 1), (min = 0), (pat = 0));
  else if (LEVELS[arg] === 'minor') ((min += 1), (pat = 0));
  else pat += 1;
  next = `${maj}.${min}.${pat}`;
} else if (/^\d+\.\d+\.\d+$/.test(arg ?? '')) {
  next = arg;
} else {
  console.error(
    'Usage: node scripts/bumpVersion.mjs <--major|-M | --minor|-m | --patch|-p | x.y.z>',
  );
  process.exit(1);
}

function replaceOnce(file, pattern, replacement) {
  const full = path.join(root, file);
  const before = readFileSync(full, 'utf-8');
  const after = before.replace(pattern, replacement);
  if (after === before) {
    console.error(`! No version field found to update in ${file}`);
    process.exit(1);
  }
  writeFileSync(full, after);
  console.log(`  updated ${file}`);
}

const jsonFiles = [
  'package.json',
  'web/package.json',
  'desktop/package.json',
  'metronome-engine/package.json',
  'presets/package.json',
  'desktop/src-tauri/tauri.conf.json',
];
for (const file of jsonFiles) {
  replaceOnce(file, /"version":\s*"[^"]*"/, `"version": "${next}"`);
}
// Cargo.toml: only the [package] version (line that STARTS with `version = `).
replaceOnce(
  'desktop/src-tauri/Cargo.toml',
  /^version = "[^"]*"/m,
  `version = "${next}"`,
);

console.log(`\n${current} -> ${next}`);

// Wait for a y/n from the user before committing the version bump,
// tagging it, and pushing it.
try {
  const rl = await readline.createInterface({ input, output });
  const answer = await rl.question(
    'Commit, tag, and push this version bump? (y/n) ',
  );
  rl.close();
  if (answer.toLowerCase() === 'y') {
    console.log('Committing...');
    const { execSync } = await import('node:child_process');
    execSync(`git add ${jsonFiles.join(' ')}`, { stdio: 'inherit' });
    execSync(`git add desktop/src-tauri/Cargo.toml`, { stdio: 'inherit' });
    execSync(`git commit -m "Bump version to ${next}"`, { stdio: 'inherit' });
    execSync(`git tag v${next}`, { stdio: 'inherit' });
    execSync(`git push && git push --tags`, { stdio: 'inherit' });
    console.log('Done.');
  } else {
    console.log('Aborted. You can commit and tag manually.');
  }
} catch (error) {
  console.error('Error during commit/tag/push:', error);
  process.exit(1);
}
