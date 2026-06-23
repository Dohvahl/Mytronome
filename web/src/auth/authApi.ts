import { API_BASE } from '../apiBase';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401
        ? 'Incorrect email or password.'
        : `Sign-in failed (${res.status}).`,
    );
  }
  return (await res.json()) as LoginResponse;
}

export async function refreshRequest(
  refreshToken: string,
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status}).`);
  }
  return (await res.json()) as LoginResponse;
}

export async function registerRequest(
  email: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await registerErrorMessage(res));
  }
}

// ASP.NET Identity returns validation problems as { errors: { Code: [msg] } }.
async function registerErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.errors && typeof body.errors === 'object') {
      const first = Object.values(body.errors).flat()[0];
      if (typeof first === 'string') return first;
    }
    if (typeof body?.detail === 'string') return body.detail;
  } catch {
    // response wasn't JSON
  }
  return `Sign-up failed (${res.status}).`;
}
