import { useEffect, useState } from 'react';
import { useMetronome } from './useMetronome';
import { BeatIndicator } from './BeatIndicator';
import { TimeSignaturePicker } from './TimeSignaturePicker';
import { TempoControl } from './TempoControl';
import { VolumeControl } from './VolumeControl';
import { SubdivisionControl } from './SubdivisionControl';
import { HelpHint } from './HelpHint';
import {
  useKeyHeld,
  useKeyPressed,
  usePointDragAdjust,
  useResizableWidth,
  useWheelAdjust,
} from './hooks';
import { PresetsPanel } from '../presets/PresetsPanel';
import { usePresets } from '../presets/usePresets';
import { samePresetSettings } from '@mytronome/presets';
import { isCompound, MIN_BPM, MAX_BPM } from '@mytronome/engine';
import './Metronome.css';

export function Metronome() {
  const {
    bpm,
    timeSignature,
    pattern,
    isRunning,
    currentBeat,
    volume,
    subdivisions,
    toggle,
    setBpm,
    setVolume,
    setSubdivisions,
    setTimeSignature,
    cycleBeat,
    applySettings,
  } = useMetronome();

  const {
    presets,
    location,
    availableLocations,
    setLocation,
    loading,
    error,
    sessionExpired,
    dismissSessionExpired,
    savePreset,
    editPreset,
    copyPreset,
    deletePreset,
    reorderPresets,
  } = usePresets();

  // Left presets drawer open/closed.
  const [presetsOpen, setPresetsOpen] = useState(false);
  // Id of the most recently loaded preset, so we can show its (live) label.
  const [loadedPresetId, setLoadedPresetId] = useState<string | null>(null);

  // The drawer is horizontally resizable; its width is remembered.
  const { width: drawerWidth, onResizeStart } = useResizableWidth({
    storageKey: 'mytronome.drawerWidth',
    defaultWidth: 340,
    min: 280,
    max: 600,
  });

  // The "session expired" notice persists until the drawer is closed.
  useEffect(() => {
    if (!presetsOpen) dismissSessionExpired();
  }, [presetsOpen, dismissSessionExpired]);

  const current = { bpm, timeSignature, pattern };
  // Looked up fresh each render, so a rename in the drawer updates the header.
  const loadedPreset = presets.find((p) => p.id === loadedPresetId);
  const isModified =
    loadedPreset !== undefined && !samePresetSettings(current, loadedPreset);

  // Holding Shift makes the +/- buttons step by 10 — but ignore Shift while the
  // presets drawer is open, so typing a capitalized label can't hijack tempo.
  const shiftHeld = useKeyHeld('Shift');
  const stepBoost = shiftHeld && !presetsOpen;
  const step = stepBoost ? 10 : 1;

  useKeyPressed(' ', toggle); // space toggles play/pause

  // Scroll wheel over the tempo display or the slider nudges BPM (±10 with Shift).
  const tempoWheelRef = useWheelAdjust<HTMLDivElement>((dir) =>
    setBpm(bpm + dir * step),
  );
  const tempoPointerRef = usePointDragAdjust<HTMLDivElement>((dir) =>
    setBpm(bpm + dir * step),
  );
  const sliderWheelRef = useWheelAdjust<HTMLInputElement>((dir) =>
    setBpm(bpm + dir * step),
  );

  return (
    <>
      <button
        className="menu-toggle"
        onClick={() => setPresetsOpen((open) => !open)}
        aria-label="Toggle presets panel"
        aria-expanded={presetsOpen}
      >
        &#9776;
      </button>

      <HelpHint />

      {presetsOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setPresetsOpen(false)}
        />
      )}

      <aside
        className={`sidebar ${presetsOpen ? 'open' : ''}`}
        style={{ width: drawerWidth }}
        // When closed, `inert` removes the off-screen drawer from the tab order
        // and the accessibility tree, so its controls can't be focused or read.
        inert={!presetsOpen}
      >
        <div className="sidebar-content">
          <VolumeControl volume={volume} onChange={setVolume} />
          <PresetsPanel
            presets={presets}
            current={current}
            location={location}
            availableLocations={availableLocations}
            loading={loading}
            error={error}
            sessionExpired={sessionExpired}
            onLocationChange={setLocation}
            onLoad={(preset) => {
              applySettings(preset);
              setLoadedPresetId(preset.id);
              setPresetsOpen(false);
            }}
            onSave={savePreset}
            onUpdate={(preset, settings) => editPreset(preset, settings)}
            onRename={(preset, label) => editPreset(preset, { label })}
            onCopy={copyPreset}
            onDelete={deletePreset}
            onReorder={reorderPresets}
          />
        </div>
        <div
          className="sidebar-resize"
          onPointerDown={onResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
        />
      </aside>

      <div className="metronome">
        <div className="loaded-preset">
          {loadedPreset?.label}
          {loadedPreset?.label && isModified ? (
            <span
              className="loaded-modified"
              title="Settings changed since this preset was loaded"
            >
              {' *'}
            </span>
          ) : null}
        </div>

        <div className="tempo-row">
          <button
            className={`step ${stepBoost ? 'step-10' : ''}`}
            onClick={() => setBpm(bpm - step)}
            aria-label={`Decrease tempo by ${step}`}
          >
            {stepBoost ? '−10' : '−'}
          </button>

          <div
            className="tempo-display"
            ref={(el) => {
              tempoWheelRef.current = el;
              tempoPointerRef.current = el;
            }}
          >
            <div className="tempo-value-area">
              <TempoControl
                value={bpm}
                min={MIN_BPM}
                max={MAX_BPM}
                step={step}
                onChange={setBpm}
              />
            </div>
            <span className="unit">BPM</span>
          </div>

          <button
            className={`step ${stepBoost ? 'step-10' : ''}`}
            onClick={() => setBpm(bpm + step)}
            aria-label={`Increase tempo by ${step}`}
          >
            {stepBoost ? '+10' : '+'}
          </button>
        </div>

        <input
          className="tempo-slider"
          type="range"
          min={MIN_BPM}
          max={MAX_BPM}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          ref={sliderWheelRef}
        />

        <div className="meter-row">
          <TimeSignaturePicker
            value={timeSignature}
            onChange={setTimeSignature}
          />
          <SubdivisionControl
            value={subdivisions}
            onChange={setSubdivisions}
            beatNoteValue={timeSignature.noteValue}
          />
        </div>

        <BeatIndicator
          pattern={pattern}
          currentBeat={currentBeat}
          onCycle={cycleBeat}
          beatsPerGroup={isCompound(timeSignature) ? 3 : 0}
        />

        <button
          className={`play ${isRunning ? 'running' : ''}`}
          onClick={toggle}
        >
          {isRunning ? 'Stop' : 'Start'}
        </button>
      </div>
    </>
  );
}
