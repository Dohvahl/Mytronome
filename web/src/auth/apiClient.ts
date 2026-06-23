import { getAuthToken, getRefreshToken, setTokens } from './token';
import { refreshRequest } from './authApi';

function withAuth(init?: RequestInit): RequestInit {
  const token = getAuthToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

// Shared in-flight refresh so concurrent 401s trigger only one refresh call.
let refreshInFlight: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(false);

  refreshInFlight ??= (async () => {
    try {
      const tokens = await refreshRequest(refreshToken);
      setTokens(tokens.accessToken, tokens.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * fetch() with the bearer token attached. On a 401 it tries once to renew the
 * token via the refresh token and replays the request. If the refresh fails,
 * the 401 propagates and the caller signs the user out.
 */
export async function apiFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let res = await fetch(url, withAuth(init));
  if (res.status === 401 && (await tryRefresh())) {
    res = await fetch(url, withAuth(init));
  }
  return res;
}
