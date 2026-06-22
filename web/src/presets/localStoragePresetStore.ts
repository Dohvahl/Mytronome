import type { Preset, PresetStore } from '@mytronome/presets';

const STORAGE_KEY = 'mytronome.presets';

/**
 * A PresetStore backed by the browser's localStorage.
 *
 * The methods are async to satisfy the PresetStore contract (localStorage
 * itself is synchronous, but a future API-backed store won't be — keeping the
 * shape async means callers never change).
 */
export class LocalStoragePresetStore implements PresetStore {
  async list(): Promise<Preset[]> {
    return this.readAll();
  }

  async save(preset: Preset): Promise<void> {
    const presets = this.readAll();
    const index = presets.findIndex((p) => p.id === preset.id);
    if (index >= 0) {
      presets[index] = preset; // overwrite existing
    } else {
      presets.push(preset); // create new
    }
    this.writeAll(presets);
  }

  async remove(id: string): Promise<void> {
    this.writeAll(this.readAll().filter((p) => p.id !== id));
  }

  private readAll(): Preset[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Preset[]) : [];
    } catch {
      // Corrupt data — start clean rather than crash.
      return [];
    }
  }

  private writeAll(presets: Preset[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }
}
