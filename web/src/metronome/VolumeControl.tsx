import { useWheelAdjust } from './hooks';

const WHEEL_STEP = 0.05;

interface Props {
  volume: number; // 0..1
  onChange: (volume: number) => void;
}

export function VolumeControl({ volume, onChange }: Props) {
  // Scroll wheel over the control nudges volume (clamped in the hook).
  const wheelRef = useWheelAdjust<HTMLDivElement>((dir) =>
    onChange(volume + dir * WHEEL_STEP),
  );

  return (
    <div className="volume-control" ref={wheelRef}>
      <label htmlFor="volume-slider" className="volume-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M11 5 L6 9 H3 a1 1 0 0 0 -1 1 v4 a1 1 0 0 0 1 1 h3 l5 4 Z"
            fill="currentColor"
          />
          <path
            d="M15.5 8.8 a4.5 4.5 0 0 1 0 6.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M18.2 6.2 a8 8 0 0 1 0 11.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </label>
      <input
        id="volume-slider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Volume"
      />
      <span className="volume-value">{Math.round(volume * 100)}%</span>
    </div>
  );
}
