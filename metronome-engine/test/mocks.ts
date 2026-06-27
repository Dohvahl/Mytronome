import type {
  AudioOutput,
  ClickSound,
  IntervalTimer,
} from '../src/audioOutput';

export interface ScheduledClick {
  time: number;
  sound: ClickSound;
}

/**
 * A test double for {@link AudioOutput}. It records every scheduled click and
 * lets the test drive the audio clock by hand, so the scheduler's timing
 * becomes fully deterministic instead of depending on real audio hardware.
 */
export class MockAudioOutput implements AudioOutput {
  currentTime = 0;
  volume = 1;
  readonly scheduled: ScheduledClick[] = [];
  cancelCount = 0;
  resumeCount = 0;
  disposed = false;

  setVolume(volume: number): void {
    this.volume = volume;
  }

  scheduleClick(time: number, sound: ClickSound): void {
    this.scheduled.push({ time, sound });
  }

  cancelScheduled(): void {
    this.cancelCount += 1;
  }

  resume(): void {
    this.resumeCount += 1;
  }

  dispose(): void {
    this.disposed = true;
  }

  /** Move the audio clock forward to absolute time `t` (seconds). */
  advanceTo(t: number): void {
    this.currentTime = t;
  }

  /** Just the scheduled times, in order. Convenient for exact-timing asserts. */
  times(): number[] {
    return this.scheduled.map((c) => c.time);
  }
}

/**
 * A manual {@link IntervalTimer}: registered handlers fire only when the test
 * calls {@link tick}, simulating one lookahead wake-up at a time.
 */
export class MockTimer implements IntervalTimer {
  private readonly handlers = new Map<number, () => void>();
  private nextId = 1;

  setInterval(handler: () => void): number {
    const id = this.nextId++;
    this.handlers.set(id, handler);
    return id;
  }

  clearInterval(id: number): void {
    this.handlers.delete(id);
  }

  /** Fire every active interval once. */
  tick(): void {
    for (const handler of [...this.handlers.values()]) handler();
  }

  /** How many intervals are currently registered (0 once the engine stops). */
  get activeCount(): number {
    return this.handlers.size;
  }
}
