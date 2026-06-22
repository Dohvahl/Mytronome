import type { Preset } from './types';

/**
 * The contract for persisting presets.
 *
 * Implementations supply the actual storage — localStorage now; a file, a cloud
 * provider, or our REST API later. Every method is async (returns a Promise) so
 * the *same* interface fits a network-backed store without changing any caller.
 * Swapping storage later is then a drop-in: implement this interface, done.
 */
export interface PresetStore {
  /** Return all saved presets. */
  list(): Promise<Preset[]>;
  /** Create a new preset, or overwrite the existing one with the same id. */
  save(preset: Preset): Promise<void>;
  /** Delete the preset with the given id (no-op if it doesn't exist). */
  remove(id: string): Promise<void>;
}
