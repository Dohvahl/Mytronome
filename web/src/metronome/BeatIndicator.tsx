import type { BeatEmphasis } from '@mytronome/engine';

interface Props {
  /** One entry per beat: 'normal' | 'accent' | 'muted'. */
  pattern: BeatEmphasis[];
  /** Zero-based index of the currently sounding beat, or -1 when stopped. */
  currentBeat: number;
  /** Called with a beat's index when its dot is clicked (to cycle emphasis). */
  onCycle: (index: number) => void;
}

/**
 * A row of clickable dots — one per beat. Each dot's resting look reflects its
 * emphasis (normal / accent / muted); the currently sounding beat lights up.
 * Clicking a dot cycles its emphasis.
 */
export function BeatIndicator({ pattern, currentBeat, onCycle }: Props) {
  return (
    <div className="beat-indicator">
      {pattern.map((emphasis, i) => {
        const classNames = ['beat-dot', emphasis, i === currentBeat ? 'active' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={i}
            type="button"
            className={classNames}
            onClick={() => onCycle(i)}
            aria-label={`Beat ${i + 1}: ${emphasis}. Click to change.`}
          />
        );
      })}
    </div>
  );
}
