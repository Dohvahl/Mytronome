import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface Props {
  /** Beats heard since start; its parity picks the swing side (flips each beat). */
  beatTick: number;
  /** Current tempo — sets the half-swing duration and the weight's position. */
  bpm: number;
  /** Whether the metronome is running; at rest the arm hangs straight up. */
  running: boolean;
  min: number;
  max: number;
  /** Drag the weight to set the tempo (up = slower). */
  onBpmChange: (bpm: number) => void;
}

/** Swing amplitude in degrees, each side of vertical. */
const SWING_DEG = 26;
/**
 * Where the weight can travel along the arm, as a fraction of the arm's height
 * from its top. The slow end (min bpm) sits high, the fast end (max bpm) low —
 * like a real metronome, where raising the weight slows the beat.
 */
const TRAVEL_TOP = 0.04;
const TRAVEL_BOTTOM = 0.74;

/**
 * The interactive metronome pendulum (pendulum layout). The arm pivots at its
 * base and flips to the opposite side each beat (parity of `beatTick`, bumped on
 * the same latency-compensated signal as the beat dots); a one-beat CSS
 * transition eases the half-swing so it stays locked to the audio. The weight
 * rides the arm at a height set by the tempo and is draggable to change it —
 * dragging up (toward the top) slows the tempo, matching a real metronome.
 */
export function Pendulum({
  beatTick,
  bpm,
  running,
  min,
  max,
  onBpmChange,
}: Props) {
  const armRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const side = beatTick % 2 === 0 ? -1 : 1;
  const angle = running ? side * SWING_DEG : 0;
  const beatSeconds = 60 / bpm;

  // Weight height along the arm from the tempo (slow → high, fast → low).
  const frac = (bpm - min) / (max - min);
  const weightTopPct = (TRAVEL_TOP + frac * (TRAVEL_BOTTOM - TRAVEL_TOP)) * 100;

  // Map a pointer's vertical position along the arm to a tempo. Measured against
  // the arm's own box; while running the arm is tilted, so this is approximate
  // then and exact at rest — good enough since the readout below types exact.
  const bpmFromPointer = (clientY: number) => {
    const arm = armRef.current;
    if (!arm) return;
    const rect = arm.getBoundingClientRect();
    const y = (clientY - rect.top) / rect.height; // 0 (top) .. 1 (bottom)
    const f = Math.min(
      1,
      Math.max(0, (y - TRAVEL_TOP) / (TRAVEL_BOTTOM - TRAVEL_TOP)),
    );
    onBpmChange(Math.round(min + f * (max - min)));
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    bpmFromPointer(e.clientY);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (draggingRef.current) bpmFromPointer(e.clientY);
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="pendulum">
      <div
        className="pendulum-arm"
        ref={armRef}
        style={{
          transform: `rotate(${angle}deg)`,
          transitionDuration: `${beatSeconds}s`,
        }}
      >
        <button
          type="button"
          className="pendulum-weight"
          style={{ top: `${weightTopPct}%` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label={`Tempo weight, ${bpm} BPM. Drag up to slow down, down to speed up.`}
        />
      </div>
      <div className="pendulum-pivot" />
    </div>
  );
}
