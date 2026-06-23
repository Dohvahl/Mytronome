import { useEffect, useRef, useState } from 'react';
import {
  Metronome,
  defaultPattern,
  type BeatEmphasis,
  type TimeSignature,
} from '@mytronome/engine';

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
  const saved = Number(localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 1;
}

/**
 * Bridges the framework-agnostic Metronome engine to React.
 *
 * The engine instance lives in a ref (it must survive re-renders and isn't
 * itself "render data"). React state mirrors the bits the UI needs to display
 * (bpm, time signature, accent pattern, running, current beat) so the screen
 * updates when they change.
 */
export function useMetronome() {
  const metronomeRef = useRef<Metronome | null>(null);
  // Pending visual-flash timers, so we can cancel them on stop/unmount.
  const beatTimersRef = useRef<number[]>([]);

  const [bpm, setBpmState] = useState(DEFAULT_BPM);
  const [timeSignature, setTimeSignatureState] =
    useState<TimeSignature>(DEFAULT_TIME_SIGNATURE);
  const [pattern, setPatternState] = useState<BeatEmphasis[]>(() =>
    defaultPattern(DEFAULT_TIME_SIGNATURE.beats),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [volume, setVolumeState] = useState(readSavedVolume);

  // Create the engine when the component mounts; dispose it when it unmounts.
  useEffect(() => {
    const engine = new Metronome({
      bpm: DEFAULT_BPM,
      timeSignature: DEFAULT_TIME_SIGNATURE,
      pattern: defaultPattern(DEFAULT_TIME_SIGNATURE.beats),
      volume: readSavedVolume(),
      onBeat: (beat) => {
        // onBeat fires when a beat is *scheduled* (up to ~100ms early). Wait
        // until it actually sounds before flashing the visual, so they line up.
        const delayMs = Math.max(0, (beat.time - engine.currentTime) * 1000);
        const timerId = window.setTimeout(() => {
          setCurrentBeat(beat.beatIndex);
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

  const start = () => {
    metronomeRef.current?.start();
    setIsRunning(true);
  };

  const stop = () => {
    metronomeRef.current?.stop();
    beatTimersRef.current.forEach((id) => window.clearTimeout(id));
    beatTimersRef.current = [];
    setIsRunning(false);
    setCurrentBeat(-1);
  };

  const toggle = () => (isRunning ? stop() : start());

  const setBpm = (value: number) => {
    const engine = metronomeRef.current;
    if (!engine) return;
    engine.setBpm(value);
    setBpmState(engine.tempo); // mirror back the clamped, rounded value
  };

  const setVolume = (value: number) => {
    const v = Math.max(0, Math.min(1, value));
    metronomeRef.current?.setVolume(v);
    setVolumeState(v);
    localStorage.setItem(VOLUME_KEY, String(v));
  };

  const setTimeSignature = (value: TimeSignature) => {
    const engine = metronomeRef.current;
    // Changing the beat COUNT resets the accent pattern to default; changing
    // only the note value keeps the pattern you've set.
    const nextPattern =
      value.beats === timeSignature.beats
        ? pattern
        : defaultPattern(value.beats);
    engine?.setTimeSignature(value);
    engine?.setPattern(nextPattern);
    setTimeSignatureState(value);
    setPatternState(nextPattern);
  };

  const cycleBeat = (index: number) => {
    const engine = metronomeRef.current;
    const next = pattern.map((emphasis, i) =>
      i === index ? NEXT_EMPHASIS[emphasis] : emphasis,
    );
    engine?.setPattern(next);
    setPatternState(next);
  };

  // Apply a full saved configuration at once (used when loading a preset).
  const applySettings = (settings: {
    bpm: number;
    timeSignature: TimeSignature;
    pattern: BeatEmphasis[];
  }) => {
    const engine = metronomeRef.current;
    engine?.setBpm(settings.bpm);
    engine?.setTimeSignature(settings.timeSignature);
    engine?.setPattern(settings.pattern);
    setBpmState(engine?.tempo ?? settings.bpm);
    setTimeSignatureState(settings.timeSignature);
    setPatternState(settings.pattern);
  };

  return {
    bpm,
    timeSignature,
    pattern,
    isRunning,
    currentBeat,
    volume,
    start,
    stop,
    toggle,
    setBpm,
    setVolume,
    setTimeSignature,
    cycleBeat,
    applySettings,
  };
}
