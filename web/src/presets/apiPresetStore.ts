import type { Preset, PresetStore } from '@mytronome/presets';
import { API_BASE, UnauthorizedError } from '../apiBase';
import { getAuthToken } from '../auth/token';

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function checkOk(res: Response, action: string): void {
  if (res.ok) return;
  if (res.status === 401) {
    throw new UnauthorizedError();
  }
  throw new Error(`Couldn't ${action} (${res.status}).`);
}

/**
 * A PresetStore that talks to the C#/.NET REST API, authenticated with the
 * stored bearer token. Same interface as LocalStoragePresetStore, so nothing
 * else in the app knows which store is in use.
 */
export class ApiPresetStore implements PresetStore {
  async list(): Promise<Preset[]> {
    const res = await fetch(`${API_BASE}/api/presets`, {
      headers: authHeaders(),
    });
    checkOk(res, 'load presets from the server');
    return (await res.json()) as Preset[];
  }

  async save(preset: Preset): Promise<void> {
    const res = await fetch(
      `${API_BASE}/api/presets/${encodeURIComponent(preset.id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(preset),
      },
    );
    checkOk(res, 'save the preset to the server');
  }

  async remove(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/presets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.status === 404) return; // already gone
    checkOk(res, 'delete the preset on the server');
  }
}
