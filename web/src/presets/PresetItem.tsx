import { useEffect, useRef, useState } from 'react';
import type { Preset } from '@mytronome/presets';

interface Props {
  preset: Preset;
  onLoad: (preset: Preset) => void;
  onUpdateToCurrent: (preset: Preset) => void;
  onRename: (preset: Preset, label: string) => void;
  onCopy: (preset: Preset) => void;
  onDelete: (preset: Preset) => void;
}

export function PresetItem({
  preset,
  onLoad,
  onUpdateToCurrent,
  onRename,
  onCopy,
  onDelete,
}: Props) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(preset.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  const startRename = () => {
    setDraft(preset.label);
    setRenaming(true);
  };

  const commitRename = () => {
    onRename(preset, draft);
    setRenaming(false);
  };

  const summary = `${preset.bpm} BPM · ${preset.timeSignature.beats}/${preset.timeSignature.noteValue}`;

  return (
    <li className="preset-item">
      <div className="preset-main">
        {renaming ? (
          <input
            ref={inputRef}
            className="preset-rename"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              else if (e.key === 'Escape') setRenaming(false);
            }}
            onBlur={commitRename}
            placeholder="Label"
          />
        ) : (
          <button
            className="preset-load"
            onClick={() => onLoad(preset)}
            title="Load this preset"
          >
            <span className="preset-label">{preset.label || 'Untitled'}</span>
            <span className="preset-summary">{summary}</span>
          </button>
        )}
      </div>

      <div className="preset-actions">
        <button onClick={() => onUpdateToCurrent(preset)} title="Overwrite with current settings">
          Update
        </button>
        <button onClick={startRename} title="Rename">
          Rename
        </button>
        <button onClick={() => onCopy(preset)} title="Duplicate">
          Copy
        </button>
        <button onClick={() => onDelete(preset)} title="Delete">
          Delete
        </button>
      </div>
    </li>
  );
}
