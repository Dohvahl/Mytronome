import { useState } from 'react';
import type { Preset, PresetSettings } from '@mytronome/presets';
import { PresetItem } from './PresetItem';
import './Presets.css';

interface Props {
  presets: Preset[];
  /** The metronome's current settings, used by "Save current" and "Update". */
  current: PresetSettings;
  onLoad: (preset: Preset) => void;
  onSave: (settings: PresetSettings, label: string) => void;
  /** Overwrite a preset's settings with the current ones ("Update"). */
  onUpdate: (preset: Preset, settings: PresetSettings) => void;
  onRename: (preset: Preset, label: string) => void;
  onCopy: (preset: Preset) => void;
  onDelete: (id: string) => void;
}

export function PresetsPanel({
  presets,
  current,
  onLoad,
  onSave,
  onUpdate,
  onRename,
  onCopy,
  onDelete,
}: Props) {
  const [label, setLabel] = useState('');

  const handleSave = () => {
    onSave(current, label);
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
              onLoad={onLoad}
              onUpdateToCurrent={(p) => onUpdate(p, current)}
              onRename={onRename}
              onCopy={onCopy}
              onDelete={(p) => onDelete(p.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
