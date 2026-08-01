/**
 * The finest division the engine will schedule. Lives here because the cursor
 * owns the subdivision half of the tick grid; the web app imports it to validate
 * a saved subdivision.
 */
export const MAX_SUBDIVISIONS = 16;

/** Round to a whole number of ticks per beat, within the supported range. */
export function clampSubdivisions(value: number): number {
  return Math.max(1, Math.min(MAX_SUBDIVISIONS, Math.round(value)));
}

/**
 * Where the metronome is on its tick grid.
 *
 * The grid has two levels: a bar holds `beatsPerBar` beats, and each beat is
 * split into `subdivisions` ticks. The cursor tracks which tick comes next and
 * knows when advancing has wrapped it back to the downbeat — the signal any
 * bar-counted behaviour hangs off.
 *
 * Position used to be four fields' worth of arithmetic spread across the
 * metronome's start(), setTimeSignature(), setSubdivisions() and its scheduling
 * loop. Gathering it here means "which tick is next, and did a bar just end?"
 * is answered by one file, and the scheduler reads as a sequence of steps
 * rather than index bookkeeping.
 *
 * It owns the grid dimensions rather than being handed them each tick, so the
 * clamping a mid-run settings change needs (a shrinking meter can strand the
 * cursor past the last beat) lives with the state it protects.
 */
export class BeatCursor {
  private beatIndex = 0;
  private subIndex = 0;

  private subdivisions: number;
  private beatsPerBar: number;

  // Fields are declared and assigned explicitly rather than using constructor
  // parameter properties: those emit real runtime code, which the build's
  // `erasableSyntaxOnly` setting disallows.
  constructor(beatsPerBar: number, subdivisions: number) {
    this.beatsPerBar = beatsPerBar;
    this.subdivisions = clampSubdivisions(subdivisions);
  }

  /** Zero-based index of the beat the next tick belongs to (0 = downbeat). */
  get currentBeat(): number {
    return this.beatIndex;
  }

  /** Ticks per beat — the scheduler spaces ticks by one beat divided by this. */
  get ticksPerBeat(): number {
    return this.subdivisions;
  }

  /**
   * True when the next tick is the beat itself rather than one of the softer
   * ticks in between. Only main beats carry emphasis and reach the UI.
   */
  get isMainBeat(): boolean {
    return this.subIndex === 0;
  }

  /**
   * True when the cursor sits on the very first tick of a bar. Read straight
   * after {@link advance} it means "that step just completed a bar" — the signal
   * bar-counted behaviour hangs off.
   */
  get atBarStart(): boolean {
    return this.subIndex === 0 && this.beatIndex === 0;
  }

  /** Return to the downbeat, for a fresh run. */
  reset(): void {
    this.beatIndex = 0;
    this.subIndex = 0;
  }

  /**
   * Step to the next tick. Returns nothing on purpose: the scheduler runs this
   * on every tick, so allocating a result object here would mean throwing one
   * away tens of times a second. Ask {@link atBarStart} afterwards instead.
   */
  advance(): void {
    this.subIndex += 1;
    if (this.subIndex < this.subdivisions) return;

    this.subIndex = 0;
    this.beatIndex = (this.beatIndex + 1) % this.beatsPerBar;
  }

  /**
   * Change how many beats a bar holds. If the cursor is already past the new
   * last beat (the meter shrank mid-bar) it drops to the downbeat rather than
   * counting to a beat that no longer exists.
   */
  setBeatsPerBar(beatsPerBar: number): void {
    this.beatsPerBar = beatsPerBar;
    if (this.beatIndex >= beatsPerBar) this.beatIndex = 0;
  }

  /** Change the ticks per beat, with the same mid-beat clamp as the meter. */
  setSubdivisions(subdivisions: number): void {
    this.subdivisions = clampSubdivisions(subdivisions);
    if (this.subIndex >= this.subdivisions) this.subIndex = 0;
  }
}
