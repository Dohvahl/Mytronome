import { useMetronome } from './useMetronome';
import { BeatIndicator } from './BeatIndicator';
import { TimeSignaturePicker } from './TimeSignaturePicker';
import './Metronome.css';

const MIN_BPM = 40;
const MAX_BPM = 320;

export function Metronome() {
  const {
    bpm,
    timeSignature,
    isRunning,
    currentBeat,
    toggle,
    setBpm,
    setTimeSignature,
  } = useMetronome();

  return (
    <div className="metronome">
      <h1>Mytronome</h1>

      <BeatIndicator beats={timeSignature.beats} currentBeat={currentBeat} />

      <div className="tempo-row">
        <button
          className="step"
          onClick={() => setBpm(bpm - 1)}
          aria-label="Decrease tempo"
        >
          &minus;
        </button>

        <label className="tempo-display">
          <input
            type="number"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
          <span className="unit">BPM</span>
        </label>

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
