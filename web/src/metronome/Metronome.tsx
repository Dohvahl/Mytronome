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

  // Holding Shift makes the +/- buttons step by 10 instead of 1.
  const shiftHeld = useKeyHeld('Shift');
  const step = shiftHeld ? 10 : 1;

  // Scroll wheel over the tempo display or the slider nudges BPM (±10 with Shift).
  const tempoWheelRef = useWheelAdjust<HTMLDivElement>((dir) =>
    setBpm(bpm + (dir * step)),
  );
  const sliderWheelRef = useWheelAdjust<HTMLInputElement>((dir) =>
    setBpm(bpm + (dir * step)),
  );

  return (
    <div className="metronome">
      <h1>Mytronome</h1>

      <BeatIndicator
        pattern={pattern}
        currentBeat={currentBeat}
        onCycle={cycleBeat}
      />

      <div className="tempo-row">
        <button
          className={`step ${shiftHeld ? 'step-10' : ''}`}
          onClick={() => setBpm(bpm - step)}
          aria-label={`Decrease tempo by ${step}`}
        >
          {shiftHeld ? '−10' : '−'}
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
          className={`step ${shiftHeld ? 'step-10' : ''}`}
          onClick={() => setBpm(bpm + step)}
          aria-label={`Increase tempo by ${step}`}
        >
          {shiftHeld ? '+10' : '+'}
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

      <PresetsPanel
        current={{ bpm, timeSignature, pattern }}
        onLoad={applySettings}
      />
    </div>
  );
}
