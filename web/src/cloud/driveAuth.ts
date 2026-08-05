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

/**
 * Which implementation is in play, decided per call rather than once.
 *
 * `isTauri()` reads a global that Tauri injects ahead of the page's own
 * scripts. That ordering normally holds — but an Android cold start can serve
 * the document, fail, and re-serve it, and deciding this at module scope would
 * then latch whatever the answer was during that first broken load. Getting it
 * wrong is silent and permanent for the session: the native Drive flow is
 * replaced by the browser one, which loads Google Identity Services from the
 * network and is blocked by the app's CSP.
 *
 * It's a property read, so there's nothing to gain by caching it.
 */
function impl(): DriveAuth {
  return isTauri() ? tauriDriveAuth : gisDriveAuth;
}

export const driveAuth: DriveAuth = {
  isConfigured: () => impl().isConfigured(),
  isConnected: () => impl().isConnected(),
  connect: () => impl().connect(),
  disconnect: () => impl().disconnect(),
  getAccessToken: () => impl().getAccessToken(),
};
