import { useEffect, useRef, useState } from 'react';
import { Metronome, type TimeSignature } from '@mytronome/engine';

const DEFAULT_BPM = 120;
const DEFAULT_TIME_SIGNATURE: TimeSignature = { beats: 4, noteValue: 4 };

/**
 * Bridges the framework-agnostic Metronome engine to React.
 *
 * The engine instance lives in a ref (it must survive re-renders and isn't
 * itself "render data"). React state mirrors the bits the UI needs to display
 * (bpm, time signature, running, current beat) so the screen updates when they
 * change.
 */
export function useMetronome() {
  const metronomeRef = useRef<Metronome | null>(null);
  // Pending visual-flash timers, so we can cancel them on stop/unmount.
  const beatTimersRef = useRef<number[]>([]);

  const [bpm, setBpmState] = useState(DEFAULT_BPM);
  const [timeSignature, setTimeSignatureState] =
    useState<TimeSignature>(DEFAULT_TIME_SIGNATURE);
  const [isRunning, setIsRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);

  // Create the engine when the component mounts; dispose it when it unmounts.
  // Doing this in an effect (not during render) keeps it correct under React
  // StrictMode, which deliberately mounts -> unmounts -> remounts in dev to
  // surface cleanup bugs.
  useEffect(() => {
    const engine = new Metronome({
      bpm: DEFAULT_BPM,
      timeSignature: DEFAULT_TIME_SIGNATURE,
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
    // Cancel any visual flashes still queued from already-scheduled beats.
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

  const setTimeSignature = (value: TimeSignature) => {
    metronomeRef.current?.setTimeSignature(value);
    setTimeSignatureState(value);
  };

  return {
    bpm,
    timeSignature,
    isRunning,
    currentBeat,
    start,
    stop,
    toggle,
    setBpm,
    setTimeSignature,
  };
}
