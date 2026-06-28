// Base URL of the preset API. Override with VITE_API_BASE_URL (it's empty in the
// container build, where nginx serves the app and proxies a relative /api).
export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5046'
).replace(/\/$/, '');

// Whether the server/accounts tier (sign-in + "Server" storage) is available in
// this build. Off unless VITE_ENABLE_SERVER=true — so the static Local+Drive
// deploy hides the sign-in/account UI, while dev and server-backed builds enable
// it. (API_BASE being "empty" means the same-origin /api proxy, not "disabled".)
export const SERVER_ENABLED = import.meta.env.VITE_ENABLE_SERVER === 'true';

/** Thrown when an API call returns 401 — the token is missing, expired, or invalid. */
export class UnauthorizedError extends Error {
  constructor(message = 'Your session has expired.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
