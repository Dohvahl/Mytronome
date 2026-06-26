// SECURITY — token storage is a deliberate tradeoff (decided 2026-06-25).
// Both the access (~1h) and refresh (~14d) tokens live in localStorage, which is
// readable by any script on the origin and therefore exfiltratable via XSS. We
// accept this because:
//   - it's mitigated by the strict CSP (set by nginx) that limits what scripts run;
//   - the alternative (refresh token in an httpOnly cookie) is web-only — it adds a
//     CSRF surface, means wrapping ASP.NET Identity's token endpoints, and does NOT
//     carry over to the planned Tauri / React Native clients, which will instead use
//     OS secure storage (Keychain/Keystore). That native hardening is the right place
//     to spend the effort and is tracked with the cross-platform auth work.
// Do not "fix" this by switching to cookies without revisiting that whole picture.
const TOKEN_KEY = 'mytronome.authToken';
const REFRESH_KEY = 'mytronome.refreshToken';

/** The stored access (bearer) token, or null if not signed in. */
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** The stored refresh token, used to renew the access token. */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

/** Store (or clear, when passed null) the access + refresh tokens together. */
export function setTokens(
  accessToken: string | null,
  refreshToken: string | null,
): void {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  else localStorage.removeItem(TOKEN_KEY);

  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  else localStorage.removeItem(REFRESH_KEY);
}

/** True when an access token is present (i.e. the Server option is usable). */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}
