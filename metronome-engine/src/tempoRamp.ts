import { MAX_BPM } from './musicalSettings';

// Tempo ramp-up limits. The UI clamps its inputs to these, and the ramp
// enforces them again on the way in so a bad value can never reach the scheduler.
export const MIN_RAMP_STEP_BPM = 1;
export const MAX_RAMP_STEP_BPM = 50;
export const MIN_RAMP_EVERY_BARS = 1;
export const MAX_RAMP_EVERY_BARS = 100;

export const DEFAULT_RAMP_CONFIG: TempoRampConfig = Object.freeze({
  enabled: false,
  stepBpm: 5,
  everyBars: 4,
});

/**
 * The ramp's settings as plain data — what a caller passes in, and what a preset
 * stores. Separate from the {@link TempoRamp} class: the class carries the live
 * bar count and the decisions, this is just the configuration it starts from.
 */
export interface TempoRampConfig {
  enabled: boolean;
  /** How much to add to the tempo at each bump. */
  stepBpm: number;
  /** How many completed bars between bumps. */
  everyBars: number;
}

/**
 * Automatic tempo ramp-up ("practice trainer"): every `everyBars` bars, raise
 * the tempo by `stepBpm`, up to the engine's maximum. Manual tempo changes are
 * allowed while it runs and do NOT restart the bar count.
 */
export class TempoRamp {
  private enabled: boolean;
  private everyBars: number = DEFAULT_RAMP_CONFIG.everyBars;
  private stepBpm: number = DEFAULT_RAMP_CONFIG.stepBpm;

  private barsSinceBump: number = 0; // Completed bars since the last ramp bump

  constructor(config: Partial<TempoRampConfig> = {}) {
    this.enabled = config.enabled ?? false;
    // Through the setters, so the same clamping applies to construction.
    this.setRamp(config);
  }

  /** How much to increase the tempo by. */
  get stepSize(): number {
    return this.stepBpm;
  }

  /** Number of bars after which we increase the tempo. */
  get after(): number {
    return this.everyBars;
  }

  isValid(): boolean {
    return (
      Number.isInteger(this.everyBars) &&
      this.everyBars >= MIN_RAMP_EVERY_BARS &&
      this.everyBars <= MAX_RAMP_EVERY_BARS &&
      Number.isInteger(this.stepBpm) &&
      this.stepBpm >= MIN_RAMP_STEP_BPM &&
      this.stepBpm <= MAX_RAMP_STEP_BPM
    );
  }

  /**
   * True while the bar being played is the last one at this tempo.
   *
   * The comparison is `>=`, matching {@link completeBar}'s: shortening the
   * interval mid-run can leave the count already past the new target, and that
   * bar still ends in a bump — so it still has to be warned about.
   */
  needWarning(currentBPM: number): boolean {
    return (
      this.isActive(currentBPM) && this.barsSinceBump >= this.everyBars - 1
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isActive(currentTempo: number): boolean {
    return this.enabled && currentTempo < MAX_BPM;
  }

  /**
   * Turn the ramp on. Starts the bar count over, so enabling mid-run always
   * gives a full `everyBars` before the first bump rather than bumping straight
   * away off a count left over from a previous run. A no-op when already on, so
   * repeat calls can't postpone a bump that's already coming.
   */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.barsSinceBump = 0;
  }

  disable(): void {
    this.enabled = false;
  }

  setRamp(ramp: Partial<TempoRampConfig>): void {
    if (ramp.enabled !== undefined)
      ramp.enabled ? this.enable() : this.disable();
    this.stepBpm = this.clampTo(
      ramp.stepBpm ?? this.stepBpm,
      MIN_RAMP_STEP_BPM,
      MAX_RAMP_STEP_BPM,
    );
    this.everyBars = this.clampTo(
      ramp.everyBars ?? this.everyBars,
      MIN_RAMP_EVERY_BARS,
      MAX_RAMP_EVERY_BARS,
    );
  }

  reset() {
    this.barsSinceBump = 0; // each run gets a full interval before the first bump
  }

  /**
   * Called as each bar finishes. Counts the bar and, once `everyBars` of them
   * have passed, raises the tempo by `stepBpm` (clamped to MAX_BPM) and starts
   * counting again. A manual setBpm deliberately doesn't reset the count.
   * Returns the BPM.
   */
  completeBar(currentBPM: number): number {
    if (!this.isActive(currentBPM)) return currentBPM;

    this.barsSinceBump += 1;
    if (this.barsSinceBump >= this.everyBars) {
      currentBPM += this.stepBpm;
      this.barsSinceBump = 0;
    }
    return currentBPM;
  }

  private clampTo(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(value)));
  }
}
