import { describe, it, expect } from 'vitest';
import { Metronome, type MetronomeOptions } from '../src/metronome';
import type { BeatInfo } from '../src/types';
import { MockAudioOutput, MockTimer } from './mocks';

/**
 * Scheduling is the metronome's defining behavior, so these tests exercise it
 * directly. A MockAudioOutput + MockTimer let us own both clocks: we advance the
 * audio clock by hand, then fire one lookahead "wake-up" at a time, and assert
 * exactly which clicks were scheduled and when — no real audio, no flakiness.
 *
 * Timing facts the assertions rely on: start() schedules the first beat a 0.05s
 * lead-in after the current clock, and each wake-up schedules every beat whose
 * time is within scheduleAheadTime (0.1s) of the current clock.
 */

function setup(options: Omit<MetronomeOptions, 'audioOutput' | 'timer'> = {}) {
  const output = new MockAudioOutput();
  const timer = new MockTimer();
  const beats: BeatInfo[] = [];
  const m = new Metronome({
    ...options,
    audioOutput: output,
    timer,
    onBeat: (b) => beats.push(b),
  });
  return { m, output, timer, beats };
}

/** Assert a list of times matches expected values within floating-point slop. */
function expectTimes(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((t, i) => expect(t).toBeCloseTo(expected[i], 6));
}

describe('exact scheduled times at several BPM', () => {
  it('120 BPM → 0.5s spacing', () => {
    const { m, output, timer } = setup({ bpm: 120 });
    m.start();
    output.advanceTo(2.0);
    timer.tick();
    expectTimes(output.times(), [0.05, 0.55, 1.05, 1.55, 2.05]);
  });

  it('60 BPM → 1.0s spacing', () => {
    const { m, output, timer } = setup({ bpm: 60 });
    m.start();
    output.advanceTo(3.0);
    timer.tick();
    expectTimes(output.times(), [0.05, 1.05, 2.05, 3.05]);
  });

  it('180 BPM → 1/3s spacing between consecutive beats', () => {
    const { m, output, timer } = setup({ bpm: 180 });
    m.start();
    output.advanceTo(1.0);
    timer.tick();
    const t = output.times();
    expect(t.length).toBeGreaterThan(2);
    for (let i = 1; i < t.length; i++) {
      expect(t[i] - t[i - 1]).toBeCloseTo(1 / 3, 6);
    }
  });
});

describe('beat and subdivision sequencing', () => {
  it('interleaves the main beat with softer sub-ticks (sub = 2)', () => {
    const { m, output, timer, beats } = setup({ bpm: 120, subdivisions: 2 });
    m.start();
    output.advanceTo(1.0);
    timer.tick();

    // accent, sub, normal, sub, normal — a sub-tick halfway between each beat.
    expect(output.scheduled.map((c) => c.sound)).toEqual([
      'accent',
      'sub',
      'normal',
      'sub',
      'normal',
    ]);
    // onBeat fires only on the main beats (not the in-between subdivisions).
    expect(beats.map((b) => b.beatIndex)).toEqual([0, 1, 2]);
    expectTimes(output.times(), [0.05, 0.3, 0.55, 0.8, 1.05]);
  });
});

describe('measure rollover', () => {
  it('wraps the beat index back to 0 at the end of the measure (3/4)', () => {
    const { m, output, timer, beats } = setup({
      bpm: 120,
      timeSignature: { beats: 3, noteValue: 4 },
    });
    m.start();
    output.advanceTo(2.0);
    timer.tick();
    expect(beats.map((b) => b.beatIndex)).toEqual([0, 1, 2, 0, 1]);
  });
});

describe('muted beats', () => {
  it('skips the click but still reports the beat to the UI', () => {
    const { m, output, timer, beats } = setup({
      bpm: 120,
      pattern: ['accent', 'muted', 'normal', 'normal'],
    });
    m.start();
    output.advanceTo(2.0);
    timer.tick();

    // Five beats happened, but the muted one made no sound: four clicks.
    expect(beats.map((b) => b.beatIndex)).toEqual([0, 1, 2, 3, 0]);
    expect(output.scheduled.map((c) => c.sound)).toEqual([
      'accent',
      'normal',
      'normal',
      'accent',
    ]);
  });
});

describe('live tempo changes', () => {
  it('applies a new BPM to beats scheduled after the change', () => {
    const { m, output, timer } = setup({ bpm: 120 });
    m.start();
    timer.tick(); // schedules beat 0 at 0.05, next locked at 0.55 (120 BPM)

    m.setBpm(60); // half speed from here on

    output.advanceTo(0.5);
    timer.tick(); // beat at 0.55, next now spaced by 1.0s
    output.advanceTo(1.5);
    timer.tick(); // beat at 1.55

    const t = output.times();
    expect(t[1] - t[0]).toBeCloseTo(0.5, 6); // pre-change spacing
    expect(t[2] - t[1]).toBeCloseTo(1.0, 6); // post-change spacing
  });
});

describe('time-signature changes', () => {
  it('rolls over at the new beat count after a meter change', () => {
    const { m, output, timer, beats } = setup({ bpm: 120 }); // 4/4
    m.start();
    timer.tick(); // beat 0

    m.setTimeSignature({ beats: 3, noteValue: 4 });

    output.advanceTo(2.0);
    timer.tick();
    // Rollover now happens after index 2 (would be 0,1,2,3,0 in 4/4).
    expect(beats.map((b) => b.beatIndex)).toEqual([0, 1, 2, 0, 1]);
  });
});

describe('stop cancels future output', () => {
  it('cancels already-scheduled clicks and stops the lookahead timer', () => {
    const { m, output, timer } = setup({ bpm: 120 });
    m.start();
    output.advanceTo(0.5);
    timer.tick();
    const scheduledBeforeStop = output.scheduled.length;

    m.stop();

    expect(output.cancelCount).toBe(1); // pending audio was cancelled
    expect(timer.activeCount).toBe(0); // lookahead loop stopped

    // No new clicks can be queued after stop.
    output.advanceTo(2.0);
    timer.tick();
    expect(output.scheduled.length).toBe(scheduledBeforeStop);
  });
});

describe('repeated start/stop calls', () => {
  it('start() is idempotent while running (no double scheduling)', () => {
    const { m, output, timer } = setup({ bpm: 120 });
    m.start();
    m.start(); // ignored
    expect(output.resumeCount).toBe(1);
    expect(timer.activeCount).toBe(1);

    timer.tick();
    expect(output.times()).toEqual([0.05]); // exactly one beat 0, not two
  });

  it('stop() while already stopped is a no-op', () => {
    const { m, output } = setup();
    m.stop();
    expect(output.cancelCount).toBe(0);
  });

  it('restarting resets the beat back to the downbeat', () => {
    const { m, output, timer, beats } = setup({ bpm: 120 });
    m.start();
    output.advanceTo(0.6);
    timer.tick(); // beats 0 and 1
    m.stop();
    beats.length = 0;

    m.start(); // clock is at 0.6 now
    timer.tick();
    expect(beats[0].beatIndex).toBe(0); // measure restarts at the downbeat
  });
});

describe('disposal', () => {
  it('stops the timer and releases the audio output', () => {
    const { m, output, timer } = setup();
    m.start();
    m.dispose();
    expect(timer.activeCount).toBe(0);
    expect(output.disposed).toBe(true);
  });
});

describe('scheduler recovery after a delayed timer wake-up', () => {
  it('catches up the whole backlog in a single wake-up', () => {
    const { m, output, timer } = setup({ bpm: 120 });
    m.start();
    // The UI thread stalled: the clock jumped a full second before the next
    // wake-up. One tick must schedule every beat now due, not just the next one.
    output.advanceTo(1.0);
    timer.tick();
    expectTimes(output.times(), [0.05, 0.55, 1.05]);
  });
});
