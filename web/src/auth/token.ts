const TOKEN_KEY = 'mytronome.authToken';

/** The stored bearer token, or null if the user isn't signed in. */
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Save (or clear, when passed null) the bearer token. */
export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/** True when a token is present (i.e. the Server storage option is usable). */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}
