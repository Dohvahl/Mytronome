import { useEffect, useRef, useState } from 'react';
import {
  createPreset,
  duplicatePreset,
  updatePreset,
  type Preset,
  type PresetSettings,
  type PresetStore,
} from '@mytronome/presets';
import { LocalStoragePresetStore } from './localStoragePresetStore';

/**
 * Loads and manages the saved presets. The concrete store (localStorage today)
 * is created here; everything else talks to the PresetStore interface, so
 * swapping in an API-backed store later touches only this one line.
 */
export function usePresets() {
  const storeRef = useRef<PresetStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = new LocalStoragePresetStore();
  }

  const [presets, setPresets] = useState<Preset[]>([]);

  // Re-read from the store and show newest-changed first.
  const refresh = async () => {
    const all = await storeRef.current!.list();
    all.sort((a, b) => b.updatedAt - a.updatedAt);
    setPresets(all);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const savePreset = async (settings: PresetSettings, label: string) => {
    await storeRef.current!.save(createPreset(settings, label));
    await refresh();
  };

  const editPreset = async (
    preset: Preset,
    changes: Partial<PresetSettings & { label: string }>,
  ) => {
    await storeRef.current!.save(updatePreset(preset, changes));
    await refresh();
  };

  const copyPreset = async (preset: Preset) => {
    await storeRef.current!.save(duplicatePreset(preset));
    await refresh();
  };

  const deletePreset = async (id: string) => {
    await storeRef.current!.remove(id);
    await refresh();
  };

  return { presets, savePreset, editPreset, copyPreset, deletePreset };
}
