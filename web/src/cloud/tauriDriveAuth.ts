import { invoke } from '@tauri-apps/api/core';
import type { DriveAuth } from './driveAuth';

// Mirrors the web flag so isConnected() can stay synchronous. Source of truth
// for tokens is the OS keychain (Rust side); this is just the UI hint.
const CONNECTED_KEY = 'mytronome.driveConnected';

/**
 * How long to wait on the consent flow before giving up.
 *
 * `drive_connect` settles only when consent completes — a dismissed Android
 * account sheet or an abandoned loopback browser tab leaves it pending with
 * nothing to resolve it, and the UI sits on "Connecting…" for the rest of the
 * session. Two minutes is long enough to read a consent screen and pick an
 * account, short enough not to read as broken.
 *
 * This gives up waiting; it does not cancel the flow. If consent lands after
 * the timeout the token is in the keychain but the UI still reads
 * disconnected — pressing Connect again picks it straight back up.
 */
const CONNECT_TIMEOUT_MS = 120_000;

export const tauriDriveAuth: DriveAuth = {
  isConfigured: () => invoke<boolean>('drive_is_configured'),
  isConnected: () => localStorage.getItem(CONNECTED_KEY) === 'true',
  connect: async () => {
    let timer: number | undefined;
    try {
      await Promise.race([
        invoke('drive_connect'),
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(
            () =>
              reject(
                new Error("Google Drive didn't respond. Please try again."),
              ),
            CONNECT_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      window.clearTimeout(timer);
    }
    // Only reached when the invoke won the race.
    localStorage.setItem(CONNECTED_KEY, 'true');
  },
  disconnect: async () => {
    await invoke('drive_disconnect');
    localStorage.removeItem(CONNECTED_KEY);
  },
  getAccessToken: () => invoke<string>('drive_get_access_token'),
};
