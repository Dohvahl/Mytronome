// Client-side Google OAuth via Google Identity Services (GIS) token model.
// Talks to the user's own Google account — our backend is not involved.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const CONNECTED_KEY = 'mytronome.driveConnected';

/** True when a Google client id is configured (otherwise the option is hidden). */
export function isDriveConfigured(): boolean {
  return CLIENT_ID !== '';
}

export function isDriveConnected(): boolean {
  return localStorage.getItem(CONNECTED_KEY) === 'true';
}

// --- GIS script loading ---------------------------------------------------
let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google sign-in.'));
    document.head.appendChild(script);
  });
  return gisPromise;
}

// --- Token handling -------------------------------------------------------
let tokenClient: GoogleTokenClient | null = null;
let accessToken: string | null = null;
let expiresAt = 0;

async function ensureTokenClient(): Promise<GoogleTokenClient> {
  await loadGis();
  if (!tokenClient) {
    tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: () => {}, // set per request
    });
  }
  return tokenClient;
}

async function requestToken(prompt: '' | 'consent'): Promise<string> {
  const client = await ensureTokenClient();
  return new Promise<string>((resolve, reject) => {
    client.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description ?? response.error));
        return;
      }
      accessToken = response.access_token;
      // Renew a minute early to avoid edge-of-expiry failures.
      expiresAt = Date.now() + (response.expires_in - 60) * 1000;
      resolve(response.access_token);
    };
    client.requestAccessToken({ prompt });
  });
}

/** Prompt the user to authorize Drive access (call from a click). */
export async function connectDrive(): Promise<void> {
  await requestToken('consent');
  localStorage.setItem(CONNECTED_KEY, 'true');
}

export function disconnectDrive(): void {
  if (accessToken) {
    try {
      window.google?.accounts.oauth2.revoke(accessToken);
    } catch {
      // best effort
    }
  }
  accessToken = null;
  expiresAt = 0;
  localStorage.removeItem(CONNECTED_KEY);
}

/** A valid access token, refreshed silently (hidden iframe) when expired. */
export async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < expiresAt) return accessToken;
  return requestToken('');
}
