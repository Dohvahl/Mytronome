import type { AudioOutput, ClickSound } from '@mytronome/engine';

/**
 * Web Audio implementation of the engine's {@link AudioOutput} contract.
 * The adapter for the browser and the Tauri webview. It owns the `AudioContext`,
 * the master gain, and the oscillator-per-click synthesis;
 * the engine's scheduler talks only to the interface and never sees
 * a Web Audio type.
 * A different platform (e.g. React Native) provides its own adapter instead of this one.
 */

const CLICK_TONES: Record<ClickSound, { frequency: number; peak: number }> = {
  accent: { frequency: 1500, peak: 0.6 }, // loud, high downbeat
  normal: { frequency: 1000, peak: 0.4 }, // the other main beats
  sub: { frequency: 1200, peak: 0.18 }, // quiet in-between subdivision tick
};

/** How long each click tone rings, in seconds. */
const CLICK_DURATION = 0.05;

export class WebAudioOutput implements AudioOutput {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 1;

  // Oscillators that have been scheduled but haven't finished sounding yet.
  // We keep references so cancelScheduled() can silence clicks already queued
  // on the hardware clock since clearing the lookahead timer alone can't do that.
  private readonly active = new Set<OscillatorNode>();

  get currentTime(): number {
    return this.audioContext?.currentTime ?? 0;
  }

  get outputLatency(): number {
    const ctx = this.audioContext;
    if (!ctx) return 0;
    // `outputLatency` is the hardware buffer delay (large on mobile webviews);
    // some engines only expose `baseLatency`. Fall back through both, then to 0
    // (older Safari has neither) so we never return NaN/undefined.
    return ctx.outputLatency || ctx.baseLatency || 0;
  }

  setVolume(volume: number): void {
    this.volume = clamp01(volume);
    if (this.masterGain && this.audioContext) {
      // Short ramp avoids a click when the level jumps.
      this.masterGain.gain.setTargetAtTime(
        this.volume,
        this.audioContext.currentTime,
        0.01,
      );
    }
  }

  resume(): Promise<void> {
    // Create the AudioContext lazily on first start: browsers only allow audio
    // to begin in response to a user gesture (a click), so we can't do this in
    // the constructor. All clicks route through a master gain so one volume
    // scales them all.
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.audioContext.destination);
      this.prime();
    }
    return this.audioContext.resume();
  }

  /**
   * Play one sample of silence the moment the context is created (inside the
   * start gesture). On mobile, opening the hardware output device takes ~100-200
   * ms; without this, the very first click — scheduled only a brief lead-in
   * ahead — can be rendered into a not-yet-ready device and lost (the missing
   * downbeat on the first-ever play). Priming kicks that device-open off early
   * so it's flowing by the time the first real click sounds. A no-op cost after
   * the first start, since the context is then reused warm.
   */
  private prime(): void {
    const ctx = this.audioContext;
    if (!ctx) return;
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  }

  scheduleClick(time: number, sound: ClickSound): void {
    const ctx = this.audioContext;
    if (!ctx || !this.masterGain) return; // not started yet; nothing to do

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const { frequency, peak } = CLICK_TONES[sound];
    osc.frequency.value = frequency;

    // A fast attack then exponential decay makes a crisp "tick" rather than a
    // sustained beep, and ramping (instead of an abrupt stop) avoids audible
    // clicks/pops in the waveform. (Exponential ramps can't reach exactly 0,
    // hence the tiny 0.0001 floor.)
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK_DURATION);

    osc.connect(gain).connect(this.masterGain);
    osc.start(time);
    osc.stop(time + CLICK_DURATION);

    // Track until it finishes so a stop() can cut off clicks scheduled ahead of
    // "now" that haven't sounded yet.
    this.active.add(osc);
    osc.onended = () => {
      this.active.delete(osc);
    };
  }

  cancelScheduled(): void {
    const now = this.currentTime;
    for (const osc of this.active) {
      try {
        // Stopping at "now" silences a click still in the future (it never
        // plays) and cuts off one mid-sound. onended then removes it.
        osc.stop(now);
      } catch {
        // Already stopped/ended; nothing to cancel.
      }
    }
    this.active.clear();
  }

  dispose(): void {
    this.cancelScheduled();
    void this.audioContext?.close();
    this.audioContext = null;
    this.masterGain = null;
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
