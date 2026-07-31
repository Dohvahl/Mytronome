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
        Toggle Ramp
      </button>
      <NumberField
        className="ramp-bars"
        name="After"
        label="After"
        value={current.everyBars}
        min={MIN_RAMP_EVERY_BARS}
        max={MAX_RAMP_EVERY_BARS}
        step={1}
        onChange={(n) => onChange({ ...current, everyBars: n })}
      />
      <NumberField
        className="ramp-step"
        name="+BPM"
        label="+BPM"
        value={current.stepBpm}
        min={MIN_RAMP_STEP_BPM}
        max={MAX_RAMP_STEP_BPM}
        step={1}
        onChange={(n) => onChange({ ...current, stepBpm: n })}
      />
    </div>
  );
}
