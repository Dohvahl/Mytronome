import { invoke } from '@tauri-apps/api/core';
import type { DriveAuth } from './driveAuth';

// Mirrors the web flag so isConnected() can stay synchronous. Source of truth
// for tokens is the OS keychain (Rust side); this is just the UI hint.
const CONNECTED_KEY = 'mytronome.driveConnected';

export const tauriDriveAuth: DriveAuth = {
  isConfigured: () => invoke<boolean>('drive_is_configured'),
  isConnected: () => localStorage.getItem(CONNECTED_KEY) === 'true',
  connect: async () => {
    await invoke('drive_connect');
    localStorage.setItem(CONNECTED_KEY, 'true');
  },
  disconnect: async () => {
    await invoke('drive_disconnect');
    localStorage.removeItem(CONNECTED_KEY);
  },
  getAccessToken: () => invoke<string>('drive_get_access_token'),
};
