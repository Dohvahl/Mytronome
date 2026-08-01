import { useEffect, useRef, useState } from 'react';
import type { Preset } from '@mytronome/presets';
import { PencilIcon, UpdateIcon, CopyIcon, TrashIcon } from './icons';
import { RampIcon } from '../metronome/rampUp/RampIcon';

interface Props {
  preset: Preset;
  onLoad: (preset: Preset) => void;
  onUpdateToCurrent: (preset: Preset) => void;
  onRename: (preset: Preset, label: string) => void;
  onCopy: (preset: Preset) => void;
  onDelete: (preset: Preset) => void;
  // Drag-and-drop reordering (front-end only).
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (id: string) => void;
  onDragEnd: () => void;
}

export function PresetItem({
  preset,
  onLoad,
  onUpdateToCurrent,
  onRename,
  onCopy,
  onDelete,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
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

  const hasLabel = preset.label.trim() !== '';
  const summary = `${preset.bpm} BPM \u{00B7} ${preset.timeSignature.beats}/${preset.timeSignature.noteValue}`;
  // A preset only carries a ramp when it was armed at save time, so its presence
  // is the whole signal. Same wording as the ramp trigger's own label.
  const rampLabel = preset.ramp
    ? `Tempo ramp: +${preset.ramp.stepBpm} BPM every ${preset.ramp.everyBars} bars`
    : undefined;

  const className = [
    'preset-item',
    isDragging ? 'dragging' : '',
    isDropTarget ? 'drop-target' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      className={className}
      // Disable dragging while renaming so text selection works.
      draggable={!renaming}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', preset.id);
        onDragStart(preset.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(preset.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(preset.id);
      }}
      onDragEnd={onDragEnd}
    >
      <span className="preset-grip" aria-hidden="true" title="Drag to reorder">
        &#10303;
      </span>

      <div className="preset-body">
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
              maxLength={200}
              placeholder="Label"
            />
          ) : (
            <button
              className="preset-load"
              onClick={() => onLoad(preset)}
              title="Load this preset"
            >
              <span className="preset-label-line">
                {rampLabel && (
                  // role=img + aria-label so the badge contributes its meaning
                  // to the load button's accessible name — the glyph itself is
                  // aria-hidden.
                  <span
                    className="preset-ramp-badge"
                    role="img"
                    aria-label={rampLabel}
                    title={rampLabel}
                  >
                    <RampIcon />
                  </span>
                )}
                <span className="preset-label">
                  {hasLabel ? preset.label : summary}
                </span>
              </span>
              {hasLabel && <span className="preset-summary">{summary}</span>}
            </button>
          )}
        </div>

        <div className="preset-actions">
          <button
            onClick={startRename}
            title="Rename"
            aria-label="Rename this preset"
          >
            <PencilIcon />
          </button>
          <button
            onClick={() => onUpdateToCurrent(preset)}
            title="Update"
            aria-label="Update this preset to match the current settings"
          >
            <UpdateIcon />
          </button>
          <button
            onClick={() => onCopy(preset)}
            title="Duplicate"
            aria-label="Duplicate this preset"
          >
            <CopyIcon />
          </button>
          <button
            onClick={() => onDelete(preset)}
            title="Delete"
            aria-label="Delete this preset"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </li>
  );
}
