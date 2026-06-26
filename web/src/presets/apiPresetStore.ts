import type { Preset, PresetStore } from '@mytronome/presets';
import { API_BASE, UnauthorizedError } from '../apiBase';
import { apiFetch } from '../auth/apiClient';

async function checkOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 401) {
    throw new UnauthorizedError();
  }
  // Prefer the server's ProblemDetails reason (e.g. the preset-limit message)
  // over a bare status code, so the user sees why the request was rejected.
  throw new Error(
    (await problemDetail(res)) ?? `Couldn't ${action} (${res.status}).`,
  );
}

async function problemDetail(res: Response): Promise<string | null> {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (typeof body?.title === 'string') return body.title;
  } catch {
    // response body wasn't JSON
  }
  return null;
}

/**
 * A PresetStore that talks to the C#/.NET REST API via apiFetch (which attaches
 * the bearer token and transparently refreshes it). Same interface as
 * LocalStoragePresetStore, so nothing else knows which store is in use.
 */
export class ApiPresetStore implements PresetStore {
  async list(): Promise<Preset[]> {
    const res = await apiFetch(`${API_BASE}/api/presets`);
    await checkOk(res, 'load presets from the server');
    return (await res.json()) as Preset[];
  }

  async save(preset: Preset): Promise<void> {
    const res = await apiFetch(
      `${API_BASE}/api/presets/${encodeURIComponent(preset.id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset),
      },
    );
    await checkOk(res, 'save the preset to the server');
  }

  async remove(id: string): Promise<void> {
    const res = await apiFetch(
      `${API_BASE}/api/presets/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    if (res.status === 404) return; // already gone
    await checkOk(res, 'delete the preset on the server');
  }
}
