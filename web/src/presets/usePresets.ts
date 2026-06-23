import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPreset,
  duplicatePreset,
  updatePreset,
  type Preset,
  type PresetSettings,
  type PresetStore,
} from '@mytronome/presets';
import { LocalStoragePresetStore } from './localStoragePresetStore';
import { ApiPresetStore } from './apiPresetStore';
import { isAuthenticated } from '../auth/token';

export type StorageLocation = 'local' | 'server';

const LOCATION_KEY = 'mytronome.storageLocation';

function readSavedLocation(): StorageLocation {
  return localStorage.getItem(LOCATION_KEY) === 'server' ? 'server' : 'local';
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

/**
 * Loads and manages presets from the chosen storage location. Both stores
 * implement the same PresetStore interface, so switching between localStorage
 * and the REST API only changes which implementation we instantiate — nothing
 * downstream has to know.
 */
export function usePresets() {
  const [location, setLocationState] =
    useState<StorageLocation>(readSavedLocation);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which storage options are usable right now. Local is always available;
  // Server only once the user is signed in (a token exists). Cloud joins later.
  const availableLocations: StorageLocation[] = isAuthenticated()
    ? ['local', 'server']
    : ['local'];

  // If the saved choice isn't currently usable (e.g. "server" while signed out),
  // fall back to Local — without forgetting the saved preference.
  const effectiveLocation: StorageLocation = availableLocations.includes(location)
    ? location
    : 'local';

  // One store per location; rebuilt only when the effective location changes.
  const store = useMemo<PresetStore>(
    () =>
      effectiveLocation === 'server'
        ? new ApiPresetStore()
        : new LocalStoragePresetStore(),
    [effectiveLocation],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await store.list();
      all.sort((a, b) => b.updatedAt - a.updatedAt);
      setPresets(all);
    } catch (e) {
      setPresets([]);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Run a mutating store op, then refresh; surface errors instead of throwing.
  const mutate = async (op: () => Promise<void>) => {
    try {
      await op();
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    await refresh();
  };

  const setLocation = (next: StorageLocation) => {
    localStorage.setItem(LOCATION_KEY, next);
    setLocationState(next);
  };

  const savePreset = (settings: PresetSettings, label: string) =>
    mutate(() => store.save(createPreset(settings, label)));

  const editPreset = (
    preset: Preset,
    changes: Partial<PresetSettings & { label: string }>,
  ) => mutate(() => store.save(updatePreset(preset, changes)));

  const copyPreset = (preset: Preset) =>
    mutate(() => store.save(duplicatePreset(preset)));

  const deletePreset = (id: string) => mutate(() => store.remove(id));

  return {
    presets,
    location: effectiveLocation,
    availableLocations,
    setLocation,
    loading,
    error,
    savePreset,
    editPreset,
    copyPreset,
    deletePreset,
  };
}
