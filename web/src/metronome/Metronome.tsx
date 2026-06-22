import { useMetronome } from './useMetronome';
import { BeatIndicator } from './BeatIndicator';
import { TimeSignaturePicker } from './TimeSignaturePicker';
import { EditableNumber } from './EditableNumber';
import { useWheelAdjust } from './hooks';
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
  } = useMetronome();

  // Scroll wheel over the tempo display or the slider nudges BPM by 1.
  const tempoWheelRef = useWheelAdjust<HTMLDivElement>((dir) =>
    setBpm(bpm + dir),
  );
  const sliderWheelRef = useWheelAdjust<HTMLInputElement>((dir) =>
    setBpm(bpm + dir),
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
          className="step"
          onClick={() => setBpm(bpm - 1)}
          aria-label="Decrease tempo"
        >
          &minus;
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
          className="step"
          onClick={() => setBpm(bpm + 1)}
          aria-label="Increase tempo"
        >
          +
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
  );
}
