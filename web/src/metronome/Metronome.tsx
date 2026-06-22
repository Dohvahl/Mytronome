import { useState } from 'react';
import { useMetronome } from './useMetronome';
import { BeatIndicator } from './BeatIndicator';
import { TimeSignaturePicker } from './TimeSignaturePicker';
import { EditableNumber } from './EditableNumber';
import { useKeyHeld, useWheelAdjust } from './hooks';
import { PresetsPanel } from '../presets/PresetsPanel';
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

  // Left presets drawer open/closed.
  const [presetsOpen, setPresetsOpen] = useState(false);

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
          current={{ bpm, timeSignature, pattern }}
          onLoad={(settings) => {
            applySettings(settings);
            setPresetsOpen(false);
          }}
        />
      </aside>

      <div className="metronome">
        <h1>Mytronome</h1>

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
