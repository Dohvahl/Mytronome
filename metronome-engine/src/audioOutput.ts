/**
 * The platform seam. The scheduler in `metronome.ts` decides *when* every click
 * happens — on an audio clock, sample-accurately — and then hands those clicks
 * to an `AudioOutput` to actually make sound. Each platform provides one adapter:
 * `WebAudioOutput` for the browser and the Tauri webview, a native synth adapter
 * on mobile later, and a mock in tests. The scheduler itself stays pure and
 * portable, with no Web Audio (or any platform) types in sight.
 */

/**
 * A click's musical role, not its waveform. The scheduler emits these; each
 * output is free to realize them however it can (an oscillator tone here, a
 * sample on another platform).
 */
export type ClickSound =
  | 'accent' // the loud, high downbeat
  | 'normal' // the other main beats
  | 'sub'; // a quiet in-between subdivision tick

/** A sink for scheduled clicks. One implementation per platform. */
export interface AudioOutput {
  /**
   * Monotonic audio-clock time in seconds against which the clock the scheduler plans.
   * 0` before the output has started (no clock running yet).
   */
  readonly currentTime: number;

  /** Master output volume, 0 (silent) to 1 (full); applied to every click. */
  setVolume(volume: number): void;

  /** Schedule one click to sound at the given audio-clock `time`. */
  scheduleClick(time: number, sound: ClickSound): void;

  /**
   * Cancel every click that has been scheduled but has not yet sounded. Called
   * on stop so audio already queued ahead of "now" doesn't leak out after the
   * user stops the metronome.
   */
  cancelScheduled(): void;

  /**
   * Start (or resume) the audio clock. In browsers this must happen in response
   * to a user gesture, so adapters may defer creating real resources until here.
   */
  resume(): void | Promise<void>;

  /** Release all resources for good. */
  dispose(): void;
}

/**
 * The repeating-timer seam for the scheduler's lookahead loop. Injected so tests
 * can drive the scheduler one deterministic "wake-up" at a time instead of
 * waiting on real wall-clock time.
 */
export interface IntervalTimer {
  setInterval(handler: () => void, ms: number): number;
  clearInterval(id: number): void;
}

/** The default timer: the host's real `setInterval`/`clearInterval`. */
export const browserTimer: IntervalTimer = {
  // In the browser `setInterval` returns a number (the IntervalTimer handle is
  // just an opaque token we hand back to clearInterval). The cast sidesteps
  // @types/node's overload, which — when present in the type-check — widens the
  // return to NodeJS.Timeout.
  setInterval: (handler, ms) =>
    globalThis.setInterval(handler, ms) as unknown as number,
  clearInterval: (id) => globalThis.clearInterval(id),
};
