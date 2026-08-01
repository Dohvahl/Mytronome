import {
  MAX_RAMP_EVERY_BARS,
  MAX_RAMP_STEP_BPM,
  MIN_RAMP_EVERY_BARS,
  MIN_RAMP_STEP_BPM,
  type TempoRampConfig,
} from '@mytronome/engine';
import { NumberField } from '../NumberField';

interface Props {
  current: TempoRampConfig;
  onChange: (rampConfig: TempoRampConfig) => void;
}

export function RampControl({ current, onChange }: Props) {
  return (
    <div className="ramp-control">
      <button
        type="button"
        role="switch"
        aria-checked={current.enabled}
        onClick={() => onChange({ ...current, enabled: !current.enabled })}
      >
        Increase Tempo
      </button>
      <NumberField
        className="ramp-step"
        name="Tempo increase"
        label="+BPM"
        value={current.stepBpm}
        min={MIN_RAMP_STEP_BPM}
        max={MAX_RAMP_STEP_BPM}
        step={1}
        onChange={(n) => onChange({ ...current, stepBpm: n })}
      />
      <span className="ramp-separator">every</span>
      <NumberField
        className="ramp-bars"
        name="Number of bars between increases"
        label="Bars"
        value={current.everyBars}
        min={MIN_RAMP_EVERY_BARS}
        max={MAX_RAMP_EVERY_BARS}
        step={1}
        onChange={(n) => onChange({ ...current, everyBars: n })}
      />
    </div>
  );
}
