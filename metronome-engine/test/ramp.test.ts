import { describe, it, expect } from 'vitest';
import { Metronome, type MetronomeOptions } from '../src/metronome';
import type { BeatInfo } from '../src/types';
import { MockAudioOutput, MockTimer } from './mocks';
import { MAX_RAMP_EVERY_BARS, MAX_RAMP_STEP_BPM } from '../src/tempoRamp';
import { MAX_BPM } from '../src/musicalSettings';

/**
 * The tempo ramp raises the tempo every N bars. These tests drive the same
 * mocked clocks as scheduler.test.ts, so a "bar" is just four beats of 4/4 and
 * we can assert exactly which beat the tempo changed on.
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

/** Run the engine long enough to cover `count` beats at 120 BPM (0.5s each). */
function playBeats(
  output: MockAudioOutput,
  timer: MockTimer,
  count: number,
): void {
  output.advanceTo(0.05 + count * 0.5);
  timer.tick();
}

describe('tempo ramp bumps', () => {
  it('raises the tempo after every N complete bars', () => {
    const { m, output, timer, beats } = setup({
      bpm: 120,
      ramp: { enabled: true, stepBpm: 5, everyBars: 2 },
    });
    m.start();
    playBeats(output, timer, 9); // 4/4: beats 0-3 bar 1, 4-7 bar 2, 8+ bar 3

    // Two bars at 120, then the bump applies from the third bar on.
    expect(beats.slice(0, 8).map((b) => b.bpm)).toEqual([
      120, 120, 120, 120, 120, 120, 120, 120,
    ]);
    expect(beats[8].bpm).toBe(125);
  });

  it('keeps bumping on each subsequent interval', () => {
    const { m, output, timer, beats } = setup({
      bpm: 120,
      ramp: { enabled: true, stepBpm: 10, everyBars: 1 },
    });
    m.start();
    playBeats(output, timer, 12); // three full bars

    expect(beats[0].bpm).toBe(120); // bar 1
    expect(beats[4].bpm).toBe(130); // bar 2
    expect(beats[8].bpm).toBe(140); // bar 3
  });

  it('does not change the tempo while disabled', () => {
    const { m, output, timer, beats } = setup({
      bpm: 120,
      ramp: { enabled: false, stepBpm: 10, everyBars: 1 },
    });
    m.start();
    playBeats(output, timer, 9);
    expect(beats.every((b) => b.bpm === 120)).toBe(true);
  });

  it('stops at MAX_BPM but keeps ticking', () => {
    const { m, output, timer, beats } = setup({
      bpm: MAX_BPM - 3,
      ramp: { enabled: true, stepBpm: 10, everyBars: 1 },
    });
    m.start();
    playBeats(output, timer, 12);

    expect(m.tempo).toBe(MAX_BPM); // clamped, not overshot
    expect(beats.length).toBeGreaterThan(8); // still producing beats
    expect(beats.at(-1)?.rampWarning).toBe(false); // and no longer warning
  });
});

describe('ramp warning', () => {
  it('is true for the whole bar before a bump, and false after it', () => {
    const { m, output, timer, beats } = setup({
      bpm: 120,
      ramp: { enabled: true, stepBpm: 5, everyBars: 2 },
    });
    m.start();
    playBeats(output, timer, 11);

    // Bar 1 (beats 0-3): nothing coming yet. Bar 2 (4-7): the bump follows it.
    expect(beats.slice(0, 4).map((b) => b.rampWarning)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(beats.slice(4, 8).map((b) => b.rampWarning)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    // Bar 3 starts the next cycle at the new tempo — no warning yet.
    expect(beats[8].rampWarning).toBe(false);
  });

  it('warns on every bar when bumping every bar', () => {
    const { m, output, timer, beats } = setup({
      bpm: 120,
      ramp: { enabled: true, stepBpm: 5, everyBars: 1 },
    });
    m.start();
    playBeats(output, timer, 5);
    expect(beats.every((b) => b.rampWarning)).toBe(true);
  });

  it('is false while the ramp is off', () => {
    const { m, output, timer, beats } = setup({ bpm: 120 });
    m.start();
    playBeats(output, timer, 5);
    expect(beats.every((b) => !b.rampWarning)).toBe(true);
  });
});

describe('ramp interaction with manual changes', () => {
  it('a manual tempo change does not restart the bar count', () => {
    const { m, output, timer, beats } = setup({
      bpm: 120,
      ramp: { enabled: true, stepBpm: 5, everyBars: 2 },
    });
    m.start();
    playBeats(output, timer, 5); // into bar 2

    m.setBpm(100); // user overrides mid-cycle

    playBeats(output, timer, 9);
    // The bump still lands after bar 2 (from the new manual tempo), rather than
    // the count starting over.
    expect(beats[8].bpm).toBe(105);
  });

  it('turning the ramp on restarts the count', () => {
    const { m, output, timer, beats } = setup({ bpm: 120 });
    m.start();
    playBeats(output, timer, 7); // nearly two bars with the ramp off

    m.ramp.setRamp({ stepBpm: 5, everyBars: 2 });
    m.ramp.enable();

    playBeats(output, timer, 16);
    // Counting starts here, so the first bump can't be earlier than two more
    // full bars — the tempo is still 120 at beat 8.
    expect(beats[8].bpm).toBe(120);
    expect(beats.at(-1)?.bpm).toBe(125);
  });

  it('restarting the metronome restarts the count', () => {
    const { m, output, timer, beats } = setup({
      bpm: 120,
      ramp: { enabled: true, stepBpm: 5, everyBars: 2 },
    });
    m.start();
    playBeats(output, timer, 9); // one bump has happened
    expect(m.tempo).toBe(125);

    m.stop();
    beats.length = 0;
    m.start();
    playBeats(output, timer, 4); // one bar in: too early for another bump

    expect(beats.every((b) => b.bpm === 125)).toBe(true);
  });
});

describe('ramp settings are clamped', () => {
  it('clamps out-of-range step and interval', () => {
    const { m } = setup({
      ramp: { enabled: true, stepBpm: 999, everyBars: 0 },
    });
    expect(m.ramp.stepSize).toBe(MAX_RAMP_STEP_BPM);
    expect(m.ramp.after).toBe(1);

    m.ramp.setRamp({ stepBpm: 0, everyBars: 9999 });
    expect(m.ramp.stepSize).toBe(1);
    expect(m.ramp.after).toBe(MAX_RAMP_EVERY_BARS);
  });

  it('rounds fractional values', () => {
    const { m } = setup({
      ramp: { enabled: true, stepBpm: 5.6, everyBars: 3.2 },
    });
    expect(m.ramp.stepSize).toBe(6);
    expect(m.ramp.after).toBe(3);
  });
});
