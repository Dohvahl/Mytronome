import type { Preset, PresetSettings } from './types';

/** Create a brand-new preset from settings and an optional label. */
export function createPreset(settings: PresetSettings, label = ''): Preset {
  const now = Date.now();
  return {
    id: newId(),
    label: label.trim(),
    bpm: settings.bpm,
    timeSignature: settings.timeSignature,
    pattern: [...settings.pattern],
    createdAt: now,
    updatedAt: now,
  };
}

/** Duplicate a preset: fresh id/timestamps and a "(copy)" label. */
export function duplicatePreset(preset: Preset): Preset {
  const now = Date.now();
  return {
    ...preset,
    id: newId(),
    label: copyLabel(preset.label),
    pattern: [...preset.pattern],
    createdAt: now,
    updatedAt: now,
  };
}

/** Return a copy of a preset with some fields changed and updatedAt bumped. */
export function updatePreset(
  preset: Preset,
  changes: Partial<PresetSettings & { label: string }>,
): Preset {
  return {
    ...preset,
    ...changes,
    label: changes.label !== undefined ? changes.label.trim() : preset.label,
    pattern: changes.pattern ? [...changes.pattern] : preset.pattern,
    updatedAt: Date.now(),
  };
}

/** True if two settings are musically identical (bpm, meter, and accents). */
export function samePresetSettings(
  a: PresetSettings,
  b: PresetSettings,
): boolean {
  return (
    a.bpm === b.bpm &&
    a.timeSignature.beats === b.timeSignature.beats &&
    a.timeSignature.noteValue === b.timeSignature.noteValue &&
    a.pattern.length === b.pattern.length &&
    a.pattern.every((emphasis, i) => emphasis === b.pattern[i])
  );
}

function copyLabel(label: string): string {
  const base = label.trim() === '' ? 'Preset' : label.trim();
  return `${base} (copy)`;
}

function newId(): string {
  // Available in browsers (secure contexts, incl. localhost) and modern Node.
  return crypto.randomUUID();
}
