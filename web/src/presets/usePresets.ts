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
  const saved = localStorage.getItem(LOCATION_KEY);
  // Recognize every real location — otherwise a saved "cloud" choice silently
  // reverts to "local" on reload.
  return saved === 'server' || saved === 'cloud' ? saved : 'local';
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
  const effectiveLocation: StorageLocation = availableLocations.includes(
    location,
  )
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

  // Bumped on every refresh so a slow in-flight load that's been superseded
  // (e.g. you switched location before it resolved) can't overwrite the list
  // that now belongs to the active store.
  const refreshIdRef = useRef(0);

  const cacheRef = useRef<Partial<Record<StorageLocation, Preset[]>>>({});

  const refresh = useCallback(
    async (opts?: { background?: boolean }) => {
      const requestId = ++refreshIdRef.current;
      if (!opts?.background) setLoading(true); // no spinner when we have cache
      setError(null);
      try {
        const all = await store.list();
        if (refreshIdRef.current !== requestId) return; // superseded — drop it
        const ordered = orderPresets(all, readOrder(effectiveLocation));
        cacheRef.current[effectiveLocation] = ordered;
        setPresets(ordered);
        writeOrder(
          effectiveLocation,
          ordered.map((p) => p.id),
        );
      } catch (e) {
        if (refreshIdRef.current !== requestId) return; // stale failure — ignore
        if (e instanceof UnauthorizedError) {
          setSessionExpired(true);
          signOut();
        } else if (!opts?.background) {
          setPresets([]); // only clear/surface when we had nothing cached to show
          setError(errorMessage(e));
        }
        // background failure: keep showing the cached list silently
      } finally {
        if (refreshIdRef.current === requestId && !opts?.background) {
          setLoading(false);
        }
      }
    },
    [store, signOut, effectiveLocation],
  );

  useEffect(() => {
    const cached = cacheRef.current[effectiveLocation];
    if (cached) {
      setPresets(cached); // instant
      void refresh({ background: true }); // ...then quietly check for changes
    } else {
      void refresh();
    }
  }, [refresh, effectiveLocation]);

  // Signing back in clears the expired notice.
  useEffect(() => {
    if (isAuthenticated) setSessionExpired(false);
  }, [isAuthenticated]);

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), []);

  // Latest presets for event handlers (avoids stale closures across renders).
  // Assigned in an effect (not during render) per the react-hooks/refs rule.
  const presetsRef = useRef(presets);
  useEffect(() => {
    presetsRef.current = presets;
  });

  // Optimistically set the list (instant UI) and remember the order.
  const commit = (next: Preset[]) => {
    presetsRef.current = next;
    setPresets(next);
    setError(null);
    cacheRef.current[effectiveLocation] = next;
    refreshIdRef.current++; // supersede any in-flight load so it can't overwrite this edit
    writeOrder(
      effectiveLocation,
      next.map((p) => p.id),
    );
  };

  // Serialize background writes so concurrent ops can't clobber each other
  // (the cloud store read-modify-writes a single file).
  const writeChain = useRef<Promise<unknown>>(Promise.resolve());

  const enqueueWrite = (op: () => Promise<void>) => {
    writeChain.current = writeChain.current
      .then(() => op())
      .catch(async (e) => {
        if (e instanceof UnauthorizedError) {
          setSessionExpired(true);
          signOut();
        } else {
          setError(errorMessage(e));
          // Await so the chain stays serialized: the next queued write waits for
          // this reconciliation read instead of racing it.
          await refresh(); // reconcile the optimistic change with the store
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
