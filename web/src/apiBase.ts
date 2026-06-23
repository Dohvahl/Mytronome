// Base URL of the preset API. Override with VITE_API_BASE_URL (it's empty in the
// container build, where nginx serves the app and proxies a relative /api).
export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5046'
).replace(/\/$/, '');

/** Thrown when an API call returns 401 — the token is missing, expired, or invalid. */
export class UnauthorizedError extends Error {
  constructor(message = 'Your session has expired.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
