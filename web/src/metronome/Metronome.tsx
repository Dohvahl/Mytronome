import { useState } from 'react';
import { useMetronome } from './useMetronome';
import { BeatIndicator } from './BeatIndicator';
import { TimeSignaturePicker } from './TimeSignaturePicker';
import { EditableNumber } from './EditableNumber';
import { useKeyHeld, useWheelAdjust } from './hooks';
import { PresetsPanel } from '../presets/PresetsPanel';
import { usePresets } from '../presets/usePresets';
import { samePresetSettings } from '@mytronome/presets';
import './Metronome.css';

const MIN_BPM = 40;
const MAX_BPM = 320;

export function Metronome() {
  const {
    bpm,
    timeSignature,
    pattern,
    isRunning,
    currentBeat,
    toggle,
    setBpm,
    setTimeSignature,
    cycleBeat,
    applySettings,
  } = useMetronome();

  const { presets, savePreset, editPreset, copyPreset, deletePreset } =
    usePresets();

  // Left presets drawer open/closed.
  const [presetsOpen, setPresetsOpen] = useState(false);
  // Id of the most recently loaded preset, so we can show its (live) label.
  const [loadedPresetId, setLoadedPresetId] = useState<string | null>(null);

  const current = { bpm, timeSignature, pattern };
  // Looked up fresh each render, so a rename in the drawer updates the header.
  const loadedPreset = presets.find((p) => p.id === loadedPresetId);
  const isModified =
    loadedPreset !== undefined && !samePresetSettings(current, loadedPreset);

  // Holding Shift makes the +/- buttons step by 10 — but ignore Shift while the
  // presets drawer is open, so typing a capitalized label can't hijack tempo.
  const shiftHeld = useKeyHeld('Shift');
  const stepBoost = shiftHeld && !presetsOpen;
  const step = stepBoost ? 10 : 1;

  // Scroll wheel over the tempo display or the slider nudges BPM (±10 with Shift).
  const tempoWheelRef = useWheelAdjust<HTMLDivElement>((dir) =>
    setBpm(bpm + (dir * step)),
  );
  const sliderWheelRef = useWheelAdjust<HTMLInputElement>((dir) =>
    setBpm(bpm + (dir * step)),
  );

  return (
    <>
      <button
        className="menu-toggle"
        onClick={() => setPresetsOpen((open) => !open)}
        aria-label="Toggle presets panel"
        aria-expanded={presetsOpen}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {presetsOpen && (
        <div className="sidebar-backdrop" onClick={() => setPresetsOpen(false)} />
      )}

      <aside
        className={`sidebar ${presetsOpen ? 'open' : ''}`}
        aria-hidden={!presetsOpen}
      >
        <PresetsPanel
          presets={presets}
          current={current}
          onLoad={(preset) => {
            applySettings(preset);
            setLoadedPresetId(preset.id);
            setPresetsOpen(false);
          }}
          onSave={savePreset}
          onUpdate={(preset, settings) => editPreset(preset, settings)}
          onRename={(preset, label) => editPreset(preset, { label })}
          onCopy={copyPreset}
          onDelete={deletePreset}
        />
      </aside>

      <div className="metronome">
        <div className="loaded-preset">
          {loadedPreset?.label}
          {loadedPreset?.label && isModified ? (
            <span
              className="loaded-modified"
              title="Settings changed since this preset was loaded"
            >
              {' *'}
            </span>
          ) : null}
        </div>

      <BeatIndicator
        pattern={pattern}
        currentBeat={currentBeat}
        onCycle={cycleBeat}
      />

      <div className="tempo-row">
        <button
          className={`step ${stepBoost ? 'step-10' : ''}`}
          onClick={() => setBpm(bpm - step)}
          aria-label={`Decrease tempo by ${step}`}
        >
          {stepBoost ? '−10' : '−'}
        </button>

        <div className="tempo-display" ref={tempoWheelRef}>
          <EditableNumber
            className="bpm-number"
            value={bpm}
            min={MIN_BPM}
            max={MAX_BPM}
            onCommit={setBpm}
            ariaLabel="Tempo in BPM"
          />
          <span className="unit">BPM</span>
        </div>

        <button
          className={`step ${stepBoost ? 'step-10' : ''}`}
          onClick={() => setBpm(bpm + step)}
          aria-label={`Increase tempo by ${step}`}
        >
          {stepBoost ? '+10' : '+'}
        </button>
      </div>

      <input
        className="tempo-slider"
        type="range"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        ref={sliderWheelRef}
      />

      <TimeSignaturePicker value={timeSignature} onChange={setTimeSignature} />

      <button
        className={`play ${isRunning ? 'running' : ''}`}
        onClick={toggle}
      >
        {isRunning ? 'Stop' : 'Start'}
      </button>
      </div>
    </>
  );
}
