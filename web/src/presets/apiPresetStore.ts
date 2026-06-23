import type { Preset, PresetStore } from '@mytronome/presets';

// Base URL of the preset API. Override with VITE_API_BASE_URL if needed.
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5046'
).replace(/\/$/, '');

/**
 * A PresetStore that talks to the C#/.NET REST API. Implements the exact same
 * interface as LocalStoragePresetStore, so the rest of the app is unaware which
 * one is in use.
 */
export class ApiPresetStore implements PresetStore {
  async list(): Promise<Preset[]> {
    const res = await fetch(`${API_BASE}/api/presets`);
    if (!res.ok) {
      throw new Error(`Couldn't load presets from the server (${res.status}).`);
    }
    return (await res.json()) as Preset[];
  }

  async save(preset: Preset): Promise<void> {
    const res = await fetch(
      `${API_BASE}/api/presets/${encodeURIComponent(preset.id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset),
      },
    );
    if (!res.ok) {
      throw new Error(`Couldn't save the preset to the server (${res.status}).`);
    }
  }

  async remove(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/presets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    // 404 means it's already gone — treat as success.
    if (!res.ok && res.status !== 404) {
      throw new Error(`Couldn't delete the preset on the server (${res.status}).`);
    }
  }
}
