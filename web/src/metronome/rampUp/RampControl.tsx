import type { TempoRampConfig } from '@mytronome/engine';

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
      <span>After {current.everyBars}</span>
      <span>+BPM {current.stepBpm}</span>
    </div>
  );
}
