import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { GoogleDrivePresetStore } from '../cloud/googleDrivePresetStore';
import { UnauthorizedError } from '../apiBase';
import { useAuth } from '../auth/AuthContext';
import { useDrive } from '../cloud/DriveContext';

export type StorageLocation = 'local' | 'server' | 'cloud';

const LOCATION_KEY = 'mytronome.storageLocation';

function readSavedLocation(): StorageLocation {
  return localStorage.getItem(LOCATION_KEY) === 'server' ? 'server' : 'local';
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

// Display order is a front-end concern, stored per location as a list of ids.
const ORDER_KEY_PREFIX = 'mytronome.presetOrder.';

function readOrder(location: StorageLocation): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY_PREFIX + location);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeOrder(location: StorageLocation, ids: string[]): void {
  localStorage.setItem(ORDER_KEY_PREFIX + location, JSON.stringify(ids));
}

/** Sort by the saved id order; presets not in it (new) sort to the top. */
function orderPresets(list: Preset[], order: string[]): Preset[] {
  const rank = new Map(order.map((id, i) => [id, i] as const));
  return [...list].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra === undefined && rb === undefined) return b.updatedAt - a.updatedAt;
    if (ra === undefined) return -1;
    if (rb === undefined) return 1;
    return ra - rb;
  });
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
  // Separate from `error` (which the fallback reload clears) so it can persist.
  const [sessionExpired, setSessionExpired] = useState(false);

  const { isAuthenticated, signOut } = useAuth();
  const { connected: driveConnected } = useDrive();

  // Which storage options are usable right now. Local is always available;
  // Server once signed in; Cloud once Google Drive is connected.
  const availableLocations: StorageLocation[] = [
    'local',
    ...(isAuthenticated ? (['server'] as StorageLocation[]) : []),
    ...(driveConnected ? (['cloud'] as StorageLocation[]) : []),
  ];

  // If the saved choice isn't currently usable (e.g. "server" while signed out),
  // fall back to Local — without forgetting the saved preference.
  const effectiveLocation: StorageLocation = availableLocations.includes(location)
    ? location
    : 'local';

  // One store per location; rebuilt only when the effective location changes.
  const store = useMemo<PresetStore>(() => {
    switch (effectiveLocation) {
      case 'server':
        return new ApiPresetStore();
      case 'cloud':
        return new GoogleDrivePresetStore();
      default:
        return new LocalStoragePresetStore();
    }
  }, [effectiveLocation]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await store.list();
      const ordered = orderPresets(all, readOrder(effectiveLocation));
      setPresets(ordered);
      writeOrder(effectiveLocation, ordered.map((p) => p.id));
    } catch (e) {
      setPresets([]);
      if (e instanceof UnauthorizedError) {
        setSessionExpired(true);
        signOut(); // expired/invalid token -> sign out and fall back to Local
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, [store, signOut, effectiveLocation]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Signing back in clears the expired notice.
  useEffect(() => {
    if (isAuthenticated) setSessionExpired(false);
  }, [isAuthenticated]);

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), []);

  // Latest presets for event handlers (avoids stale closures across renders).
  const presetsRef = useRef(presets);
  presetsRef.current = presets;

  // Optimistically set the list (instant UI) and remember the order.
  const commit = (next: Preset[]) => {
    presetsRef.current = next;
    setPresets(next);
    setError(null);
    writeOrder(effectiveLocation, next.map((p) => p.id));
  };

  // Serialize background writes so concurrent ops can't clobber each other
  // (the cloud store read-modify-writes a single file).
  const writeChain = useRef<Promise<unknown>>(Promise.resolve());

  const enqueueWrite = (op: () => Promise<void>) => {
    writeChain.current = writeChain.current
      .then(() => op())
      .catch((e) => {
        if (e instanceof UnauthorizedError) {
          setSessionExpired(true);
          signOut();
        } else {
          setError(errorMessage(e));
          void refresh(); // reconcile the optimistic change with the store
        }
      });
  };

  const setLocation = (next: StorageLocation) => {
    localStorage.setItem(LOCATION_KEY, next);
    setLocationState(next);
  };

  const savePreset = (settings: PresetSettings, label: string) => {
    const preset = createPreset(settings, label);
    commit([preset, ...presetsRef.current]); // new presets go to the top
    enqueueWrite(() => store.save(preset));
  };

  const editPreset = (
    preset: Preset,
    changes: Partial<PresetSettings & { label: string }>,
  ) => {
    const updated = updatePreset(preset, changes);
    commit(presetsRef.current.map((p) => (p.id === preset.id ? updated : p)));
    enqueueWrite(() => store.save(updated));
  };

  const copyPreset = (preset: Preset) => {
    const copy = duplicatePreset(preset);
    const current = presetsRef.current;
    const index = current.findIndex((p) => p.id === preset.id);
    const next = [...current];
    next.splice(index + 1, 0, copy); // place the copy right after the original
    commit(next);
    enqueueWrite(() => store.save(copy));
  };

  const deletePreset = (id: string) => {
    commit(presetsRef.current.filter((p) => p.id !== id));
    enqueueWrite(() => store.remove(id));
  };

  // Front-end only: reorder the visible presets and remember it per location.
  const reorderPresets = (orderedIds: string[]) => {
    const byId = new Map(presetsRef.current.map((p) => [p.id, p] as const));
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((p): p is Preset => p !== undefined);
    commit(next);
  };

  return {
    presets,
    location: effectiveLocation,
    availableLocations,
    setLocation,
    loading,
    error,
    sessionExpired,
    dismissSessionExpired,
    savePreset,
    editPreset,
    copyPreset,
    deletePreset,
    reorderPresets,
  };
}
