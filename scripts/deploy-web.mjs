// Uploads the built web app (web/dist) to the static host over SFTP.
// Run via `npm run deploy:web` (which builds first, then runs this).
//
// Reads a gitignored config next to this file:
//   scripts/deploy-web.config.json   (copy from deploy-web.config.example.json)
// Fields:
//   host        SFTP host (from the IONOS panel)
//   port        SFTP port (default 22)
//   username    SFTP username
//   password    SFTP password            ─┐ provide one of these
//   privateKeyPath  path to an SSH key   ─┘ (key is preferred if available)
//   remoteDir   the subdomain's docroot on the host (e.g. "/mytronome")
//   clearAssets if true, delete the remote assets/ dir first so old hashed
//               bundles don't accumulate

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import SftpClient from 'ssh2-sftp-client';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, '..', 'web', 'dist');
const configPath = path.join(here, 'deploy-web.config.json');

if (!existsSync(configPath)) {
  console.error(
    `Missing ${configPath}\n` +
      `Copy scripts/deploy-web.config.example.json -> scripts/deploy-web.config.json and fill it in.`,
  );
  process.exit(1);
}
if (!existsSync(path.join(distDir, 'index.html'))) {
  console.error(
    `No build found at ${distDir}.\n` +
      `Run "npm run build -w web" first (or use "npm run deploy:web").`,
  );
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
const remoteDir = String(cfg.remoteDir).replace(/\/+$/, '');

const connectOpts = {
  host: cfg.host,
  port: cfg.port ?? 22,
  username: cfg.username,
};
if (cfg.privateKeyPath) {
  connectOpts.privateKey = readFileSync(cfg.privateKeyPath);
} else {
  connectOpts.password = cfg.password;
}

const sftp = new SftpClient();
try {
  console.log(`Connecting to ${cfg.username}@${cfg.host} ...`);
  await sftp.connect(connectOpts);

  if (cfg.clearAssets) {
    const remoteAssets = `${remoteDir}/assets`;
    if (await sftp.exists(remoteAssets)) {
      console.log(`Clearing old ${remoteAssets} ...`);
      await sftp.rmdir(remoteAssets, true);
    }
  }

  console.log(`Uploading web/dist -> ${remoteDir} ...`);
  await sftp.uploadDir(distDir, remoteDir);
  console.log('✓ Deployed.');
} catch (err) {
  console.error('Deploy failed:', err.message);
  process.exitCode = 1;
} finally {
  await sftp.end();
}
