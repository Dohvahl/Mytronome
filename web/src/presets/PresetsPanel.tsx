import { useState } from 'react';
import type { Preset, PresetSettings } from '@mytronome/presets';
import type { StorageLocation } from './usePresets';
import { PresetItem } from './PresetItem';
import { AccountControl } from '../auth/AccountControl';
import { CloudControl } from '../cloud/CloudControl';
import { SERVER_ENABLED } from '../apiBase';
import './Presets.css';

const LOCATION_LABELS: Record<string, string> = {
  local: 'Local',
  server: 'Server',
  cloud: 'Drive',
};

interface Props {
  presets: Preset[];
  /** The metronome's current settings, used by "Save current" and "Update". */
  current: PresetSettings;
  location: StorageLocation;
  availableLocations: StorageLocation[];
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
  onLocationChange: (location: StorageLocation) => void;
  onLoad: (preset: Preset) => void;
  onSave: (settings: PresetSettings, label: string) => void;
  /** Overwrite a preset's settings with the current ones ("Update"). */
  onUpdate: (preset: Preset, settings: PresetSettings) => void;
  onRename: (preset: Preset, label: string) => void;
  onCopy: (preset: Preset) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function PresetsPanel({
  presets,
  current,
  location,
  availableLocations,
  loading,
  error,
  sessionExpired,
  onLocationChange,
  onLoad,
  onSave,
  onUpdate,
  onRename,
  onCopy,
  onDelete,
  onReorder,
}: Props) {
  const [label, setLabel] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleSave = () => {
    onSave(current, label);
    setLabel('');
  };

  const handleDrop = (targetId: string) => {
    if (dragId && dragId !== targetId) {
      const ids = presets.map((p) => p.id);
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(targetId);
      if (from !== -1 && to !== -1) {
        ids.splice(from, 1);
        ids.splice(to, 0, dragId);
        onReorder(ids);
      }
    }
    setDragId(null);
    setOverId(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setOverId(null);
  };

  return (
    <section className="presets">
      <h2>Presets</h2>

      {sessionExpired && (
        <p className="preset-notice">
          Your session expired — please sign in again.
        </p>
      )}

      {availableLocations.length > 1 && (
        <div
          className="storage-switch"
          role="group"
          aria-label="Preset storage location"
        >
          {availableLocations.map((loc) => (
            <button
              key={loc}
              className={location === loc ? 'active' : ''}
              onClick={() => onLocationChange(loc)}
            >
              {LOCATION_LABELS[loc] ?? loc}
            </button>
          ))}
        </div>
      )}

      <div className="preset-save">
        <input
          className="preset-label-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          maxLength={200}
          placeholder="Label (optional)"
        />
        <button className="preset-save-btn" onClick={handleSave}>
          Save current
        </button>
      </div>

      {loading && <p className="preset-empty">Loading…</p>}

      {!loading && error && <p className="preset-error">{error}</p>}

      {!loading && !error && presets.length === 0 && (
        <p className="preset-empty">
          No presets yet — set a tempo and save it.
        </p>
      )}

      {!loading && presets.length > 0 && (
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
              isDragging={dragId === preset.id}
              isDropTarget={
                overId === preset.id && dragId !== null && dragId !== preset.id
              }
              onDragStart={setDragId}
              onDragOver={setOverId}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))}
        </ul>
      )}

      <div className="drawer-footer">
        {SERVER_ENABLED && <AccountControl />}
        <CloudControl />
        <a
          className="drawer-legal"
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy
        </a>
      </div>
    </section>
  );
}
