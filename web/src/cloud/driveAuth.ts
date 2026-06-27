import { isTauri } from '@tauri-apps/api/core';
import { gisDriveAuth } from './googleAuth';
import { tauriDriveAuth } from './tauriDriveAuth';

/** Drive auth strategy. Two impls: GIS (web) and the Rust loopback flow (desktop). */
export interface DriveAuth {
  isConfigured(): Promise<boolean>;
  isConnected(): boolean; // localStorage-backed on both, so callers stay sync
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAccessToken(): Promise<string>;
}

export const driveAuth: DriveAuth = isTauri() ? tauriDriveAuth : gisDriveAuth;
