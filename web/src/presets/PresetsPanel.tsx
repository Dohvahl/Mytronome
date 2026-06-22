import { useState } from 'react';
import type { PresetSettings } from '@mytronome/presets';
import { usePresets } from './usePresets';
import { PresetItem } from './PresetItem';
import './Presets.css';

interface Props {
  /** The metronome's current settings, used by "Save current" and "Update". */
  current: PresetSettings;
  /** Apply a saved preset's settings to the live metronome. */
  onLoad: (settings: PresetSettings) => void;
}

export function PresetsPanel({ current, onLoad }: Props) {
  const { presets, savePreset, editPreset, copyPreset, deletePreset } =
    usePresets();
  const [label, setLabel] = useState('');

  const handleSave = () => {
    void savePreset(current, label);
    setLabel('');
  };

  return (
    <section className="presets">
      <h2>Presets</h2>

      <div className="preset-save">
        <input
          className="preset-label-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          placeholder="Label (optional)"
        />
        <button className="preset-save-btn" onClick={handleSave}>
          Save current
        </button>
      </div>

      {presets.length === 0 ? (
        <p className="preset-empty">No presets yet — set a tempo and save it.</p>
      ) : (
        <ul className="preset-list">
          {presets.map((preset) => (
            <PresetItem
              key={preset.id}
              preset={preset}
              onLoad={(p) => onLoad(p)}
              onUpdateToCurrent={(p) => void editPreset(p, current)}
              onRename={(p, newLabel) => void editPreset(p, { label: newLabel })}
              onCopy={(p) => void copyPreset(p)}
              onDelete={(p) => void deletePreset(p.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
