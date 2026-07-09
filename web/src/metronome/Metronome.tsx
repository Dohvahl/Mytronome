import { useCallback, useEffect, useState } from 'react';
import { useMetronome } from './useMetronome';
import { BeatIndicator } from './BeatIndicator';
import { TimeSignaturePicker } from './TimeSignaturePicker';
import { TempoControl } from './TempoControl';
import { VolumeControl } from './VolumeControl';
import { SubdivisionControl } from './SubdivisionControl';
import { HelpHint } from './HelpHint';
import { BrandHeader } from './BrandHeader';
import { SettingsModal } from './SettingsModal';
import { Pendulum } from './Pendulum';
import {
  useAccent,
  useKeyHeld,
  useKeyPressed,
  useLayoutMode,
  usePointDragAdjust,
  useResizableWidth,
  useTheme,
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
    beatTick,
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
  // The tempo display responds to both wheel and touch-drag; each layout's
  // display element gets both. Memoized so switching layouts doesn't re-bind on
  // every render (the underlying hook refs are stable).
  const tempoDisplayRef = useCallback(
    (el: HTMLDivElement | null) => {
      tempoWheelRef(el);
      tempoPointerRef(el);
    },
    [tempoWheelRef, tempoPointerRef],
  );

  const [layoutMode, setLayoutMode] = useLayoutMode();
  const [theme, setTheme] = useTheme();
  const [accent, setAccent] = useAccent(theme);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Pendulum layout: the time-signature control is collapsed by default.
  const [tsOpen, setTsOpen] = useState(false);

  return (
    <>
      <button
        className="menu-toggle"
        onClick={() => setPresetsOpen((open) => !open)}
        aria-label="Toggle presets panel"
        aria-expanded={presetsOpen}
      >
        <span className="menu-icon" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      <HelpHint />

      <button
        type="button"
        className="settings-toggle"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {settingsOpen && (
        <SettingsModal
          theme={theme}
          onThemeChange={setTheme}
          layout={layoutMode}
          onLayoutChange={setLayoutMode}
          accent={accent}
          onAccentChange={setAccent}
          onClose={() => setSettingsOpen(false)}
        />
      )}

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

      <BrandHeader />

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

        {layoutMode === 'pendulum' ? (
          <div className="pendulum-layout">
            <Pendulum
              beatTick={beatTick}
              bpm={bpm}
              running={isRunning}
              min={MIN_BPM}
              max={MAX_BPM}
              onBpmChange={setBpm}
            />
            <div className="pendulum-readout">
              <div className="tempo-value-area" ref={tempoDisplayRef}>
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
            <div className="pendulum-ts">
              <button
                type="button"
                className="pendulum-ts-toggle"
                onClick={() => setTsOpen((open) => !open)}
                aria-expanded={tsOpen}
              >
                Time signature
              </button>
              {tsOpen && (
                <TimeSignaturePicker
                  value={timeSignature}
                  onChange={setTimeSignature}
                />
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="tempo-cluster">
              <div className="tempo-row">
                <button
                  className={`step ${stepBoost ? 'step-10' : ''}`}
                  onClick={() => setBpm(bpm - step)}
                  aria-label={`Decrease tempo by ${step}`}
                >
                  {stepBoost ? '−10' : '−'}
                </button>

                <div className="tempo-display" ref={tempoDisplayRef}>
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
            </div>

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
          </>
        )}

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
