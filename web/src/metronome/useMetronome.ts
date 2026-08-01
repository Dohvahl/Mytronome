import { useEffect, useRef, useState } from 'react';
import {
  Metronome,
  defaultPattern,
  MAX_SUBDIVISIONS,
  type BeatEmphasis,
  type TimeSignature,
  type TempoRampConfig,
  DEFAULT_RAMP_CONFIG,
  MIN_RAMP_EVERY_BARS,
  MAX_RAMP_EVERY_BARS,
  MIN_RAMP_STEP_BPM,
  MAX_RAMP_STEP_BPM,
} from '@mytronome/engine';
import { clampSubdivision } from './subdivisions/subdivisions';
import { WebAudioOutput } from './webAudioOutput';

const DEFAULT_BPM = 120;
const DEFAULT_TIME_SIGNATURE: TimeSignature = { beats: 4, noteValue: 4 };

// Clicking a beat cycles through these in order.
const NEXT_EMPHASIS: Record<BeatEmphasis, BeatEmphasis> = {
  accent: 'muted',
  normal: 'accent',
  muted: 'normal',
};

const VOLUME_KEY = 'mytronome.volume';

function readSavedVolume(): number {
  const saved = Number(localStorage.getItem(VOLUME_KEY) ?? 1);
  return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 1;
}

const SUBDIVISIONS_KEY = 'mytronome.subdivisions';

function readSavedSubdivisions(): number {
  const saved = Number(localStorage.getItem(SUBDIVISIONS_KEY));
  return Number.isInteger(saved) && saved >= 1 && saved <= MAX_SUBDIVISIONS
    ? saved
    : 1;
}

const TEMPO_RAMP_KEY = 'mytronome.tempoRamp';

function readSavedTempoRamp(): TempoRampConfig {
  const raw = localStorage.getItem(TEMPO_RAMP_KEY);
  if (!raw) return DEFAULT_RAMP_CONFIG;

  let config: TempoRampConfig;
  try {
    const parsed = JSON.parse(raw);
    config = parsed as TempoRampConfig;
  } catch {
    return DEFAULT_RAMP_CONFIG;
  }

  return config &&
    typeof config.enabled === 'boolean' &&
    Number.isInteger(config.everyBars) &&
    config.everyBars >= MIN_RAMP_EVERY_BARS &&
    config.everyBars <= MAX_RAMP_EVERY_BARS &&
    Number.isInteger(config.stepBpm) &&
    config.stepBpm >= MIN_RAMP_STEP_BPM &&
    config.stepBpm <= MAX_RAMP_STEP_BPM
    ? config
    : DEFAULT_RAMP_CONFIG;
}

/**
 * Bridges the framework-agnostic Metronome engine to React.
 *
 * The engine instance lives in a ref (it must survive re-renders and isn't
 * itself "render data"). React state mirrors the bits the UI needs to display
 * (bpm, time signature, accent pattern, running, current beat) so the screen
 * updates when they change.
 *
 * `flatten` makes the engine play an even, accent-free tick with no
 * subdivisions — used by the Pendulum layout when its time-signature section is
 * collapsed. It's a playback override: the stored pattern/subdivisions are left
 * intact (the other layouts and saved presets keep them) and come back the
 * moment `flatten` turns off.
 */
export function useMetronome(flatten = false) {
  const metronomeRef = useRef<Metronome | null>(null);
  // Pending visual-flash timers, so we can cancel them on stop/unmount.
  const beatTimersRef = useRef<number[]>([]);
  // Counts tempo changes the USER made. A beat carries the tempo it was
  // scheduled at, and its visual is held back until the beat sounds — a gap of
  // up to a few hundred ms on mobile. If the tempo is moved by hand inside that
  // window, the beat's now-stale value must not overwrite it, so each beat
  // remembers the count it was scheduled under and checks it still holds. Ramp
  // bumps deliberately don't count: they're exactly what the readout is waiting
  // to show.
  const tempoEditsRef = useRef(0);

  const [bpm, setBpmState] = useState(DEFAULT_BPM);
  const [timeSignature, setTimeSignatureState] = useState<TimeSignature>(
    DEFAULT_TIME_SIGNATURE,
  );
  const [pattern, setPatternState] = useState<BeatEmphasis[]>(() =>
    defaultPattern(DEFAULT_TIME_SIGNATURE),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  // Monotonic count of beats heard since the last start — its parity drives the
  // pendulum's swing direction (flips each beat), incremented on the same
  // latency-compensated signal as currentBeat so the swing stays in sync.
  const [beatTick, setBeatTick] = useState(0);
  const [volume, setVolumeState] = useState(readSavedVolume);
  const [subdivisions, setSubdivisionsState] = useState(readSavedSubdivisions);

  const [tempoRamp, setTempoRampState] =
    useState<TempoRampConfig>(readSavedTempoRamp);
  const [rampWarning, setRampWarning] = useState(false);

  // Create the engine when the component mounts; dispose it when it unmounts.
  useEffect(() => {
    const engine = new Metronome({
      audioOutput: new WebAudioOutput(), // the browser / Tauri-webview adapter
      bpm: DEFAULT_BPM,
      timeSignature: DEFAULT_TIME_SIGNATURE,
      pattern: defaultPattern(DEFAULT_TIME_SIGNATURE),
      volume: readSavedVolume(),
      subdivisions: readSavedSubdivisions(),
      ramp: readSavedTempoRamp(),
      onBeat: (beat) => {
        // The tempo edit count as of scheduling — see tempoEditsRef.
        const tempoEdits = tempoEditsRef.current;

        // onBeat fires when a beat is *scheduled* (up to ~100ms early). Wait
        // until it actually sounds before flashing the visual, so they line up.
        // Two gaps to cover: (1) beat.time - currentTime, the scheduling lead;
        // (2) outputLatency, the hardware buffer delay before the click reaches
        // the speaker (tiny on desktop, but 100-300ms in a mobile webview — this
        // is what keeps the dot and the tick in sync on Android).
        const delayMs = Math.max(
          0,
          (beat.time - engine.currentTime + engine.outputLatency) * 1000,
        );
        const timerId = window.setTimeout(() => {
          // The ramp may have moved the tempo; show it as the beat sounds, not
          // when it was planned — unless the user has since set one themselves.
          if (tempoEditsRef.current === tempoEdits) setBpmState(beat.bpm);

          // if ramp function is in use, we may need to show the warning to
          // the user in the last bar. This need to be in sync with the beat indicator.
          setRampWarning(beat.rampWarning);

          setCurrentBeat(beat.beatIndex);
          setBeatTick((t) => t + 1);
          beatTimersRef.current = beatTimersRef.current.filter(
            (id) => id !== timerId,
          );
        }, delayMs);
        beatTimersRef.current.push(timerId);
      },
    });
    metronomeRef.current = engine;

    return () => {
      engine.dispose();
      beatTimersRef.current.forEach((id) => window.clearTimeout(id));
      beatTimersRef.current = [];
      metronomeRef.current = null;
    };
  }, []);

  // Drive the engine's accent pattern and subdivisions from React state here
  // (rather than imperatively in the setters) so `flatten` can override them in
  // one place: when it's on, the engine plays an even, accent-free tick with no
  // subdivisions; the stored `pattern`/`subdivisions` are untouched, so turning
  // it back off restores them.
  useEffect(() => {
    const engine = metronomeRef.current;
    if (!engine) return;
    engine.setPattern(flatten ? pattern.map(() => 'normal' as const) : pattern);
  }, [flatten, pattern]);

  useEffect(() => {
    metronomeRef.current?.setSubdivisions(flatten ? 1 : subdivisions);
  }, [flatten, subdivisions]);

  useEffect(() => {
    metronomeRef.current?.setRampConfig(tempoRamp);
  }, [tempoRamp]);

  const start = () => {
    setRampWarning(false);
    metronomeRef.current?.start();
    setIsRunning(true);
  };

  const stop = () => {
    metronomeRef.current?.stop();
    beatTimersRef.current.forEach((id) => window.clearTimeout(id));
    beatTimersRef.current = [];
    setIsRunning(false);
    setCurrentBeat(-1);
    setBeatTick(0);
    setRampWarning(false);
  };

  const toggle = () => (isRunning ? stop() : start());

  const setBpm = (value: number) => {
    const engine = metronomeRef.current;
    if (!engine) return;
    engine.setBpm(value);
    tempoEditsRef.current += 1; // supersede any beat still waiting to sound
    setBpmState(engine.tempo); // mirror back the clamped, rounded value
  };

  const setVolume = (value: number) => {
    const v = Math.max(0, Math.min(1, value));
    metronomeRef.current?.setVolume(v);
    setVolumeState(v);
    localStorage.setItem(VOLUME_KEY, String(v));
  };

  const setSubdivisions = (value: number) => {
    // The engine is synced from `subdivisions` state by the effect above.
    setSubdivisionsState(value);
    localStorage.setItem(SUBDIVISIONS_KEY, String(value));
  };

  const setTimeSignature = (value: TimeSignature) => {
    const engine = metronomeRef.current;
    // Changing the beat COUNT resets the accent pattern to default; changing
    // only the note value keeps the pattern you've set.
    const nextPattern =
      value.beats === timeSignature.beats ? pattern : defaultPattern(value);
    engine?.setTimeSignature(value);
    setTimeSignatureState(value);
    setPatternState(nextPattern); // engine pattern is synced by the effect above

    // Subdivisions are shown relative to the beat. Keep the same division when
    // the new beat note can still represent it; otherwise step to the nearest.
    const nextSub = clampSubdivision(subdivisions, value.noteValue);
    if (nextSub !== subdivisions) setSubdivisions(nextSub);
  };

  const setTempoRamp = (value: TempoRampConfig) => {
    setTempoRampState(value);
    localStorage.setItem(
      TEMPO_RAMP_KEY,
      JSON.stringify({ ...value, enabled: false }),
    );
  };

  const cycleBeat = (index: number) => {
    const next = pattern.map((emphasis, i) =>
      i === index ? NEXT_EMPHASIS[emphasis] : emphasis,
    );
    setPatternState(next); // engine pattern is synced by the effect above
  };

  // Apply a full saved configuration at once (used when loading a preset).
  const applySettings = (settings: {
    bpm: number;
    timeSignature: TimeSignature;
    pattern: BeatEmphasis[];
    subdivisions: number;
    ramp?: TempoRampConfig;
  }) => {
    const engine = metronomeRef.current;
    engine?.setBpm(settings.bpm);
    engine?.setTimeSignature(settings.timeSignature);
    tempoEditsRef.current += 1; // a preset's tempo outranks a beat mid-flight
    setBpmState(engine?.tempo ?? settings.bpm); // pattern synced by effect above
    setTimeSignatureState(settings.timeSignature);
    setPatternState(settings.pattern);

    // Apply the preset's subdivision, clamped to what its beat note can show.
    setSubdivisions(
      clampSubdivision(settings.subdivisions, settings.timeSignature.noteValue),
    );

    // A preset only carries a ramp when it was armed at save time, so one
    // without a ramp switches it OFF — otherwise the last preset's ramp would
    // keep running away with the tempo of a preset that never asked for it. The
    // step/interval numbers are kept, so the panel doesn't jump around.
    setTempoRamp(settings.ramp ?? { ...tempoRamp, enabled: false });
  };

  return {
    bpm,
    timeSignature,
    pattern,
    isRunning,
    currentBeat,
    beatTick,
    volume,
    subdivisions,
    tempoRamp,
    rampWarning,
    start,
    stop,
    toggle,
    setBpm,
    setVolume,
    setSubdivisions,
    setTimeSignature,
    setTempoRamp,
    cycleBeat,
    applySettings,
  };
}
