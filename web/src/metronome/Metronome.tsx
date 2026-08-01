import { useEffect, useState, type CSSProperties } from 'react';
import { useMetronome } from './useMetronome';
import { NumberField } from './NumberField';
import { BeatIndicator } from './meter/BeatIndicator';
import { TimeSignaturePicker } from './meter/TimeSignaturePicker';
import { VolumeControl } from './volume/VolumeControl';
import { HelpHint } from './helpModal/HelpHint';
import { BrandHeader } from './BrandHeader';
import { SettingsModal } from './settingsModal/SettingsModal';
import { Pendulum } from './layouts/Pendulum';
import { PresetsPanel } from '../presets/PresetsPanel';
import { usePresets } from '../presets/usePresets';
import { samePresetSettings } from '@mytronome/presets';
import { isCompound, MIN_BPM, MAX_BPM } from '@mytronome/engine';
import './Metronome.css';
import { useLayoutMode } from './layouts/hooks';
import { useAccent, useTheme } from './appearance/hooks';
import { SubdivisionControl } from './subdivisions/SubdivisionControl';
import { useResizableWidth } from '../presets/hooks';
import { useKeyHeld, useKeyPressed } from './keyboard';
import { useWheelAdjust } from './gestures';
import { RampControl } from './rampUp/RampControl';
import { RampIcon } from './rampUp/RampIcon';

export function Metronome() {
  const [layoutMode, setLayoutMode] = useLayoutMode();
  // Pendulum layout: the time-signature section is collapsed by default.
  const [tsOpen, setTsOpen] = useState(false);
  // In the Pendulum layout with that section collapsed, the metronome plays a
  // plain even tick — no accents, no subdivisions (a non-destructive override).
  const flatten = layoutMode === 'pendulum' && !tsOpen;

  const {
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
    toggle,
    setBpm,
    setVolume,
    setSubdivisions,
    setTimeSignature,
    setTempoRamp,
    cycleBeat,
    applySettings,
  } = useMetronome(flatten);

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
  // Ramp section open/closed
  const [rampOpen, setRampOpen] = useState(false);
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

  // Dismissing the ramp panel. Bound only while it's open, so there's no idle
  // listener on the document.
  //
  // Tapping away closes it ONLY on narrow screens, where the panel covers the
  // metronome and you must close it to play. With room to spare it sits beside
  // the metronome harmlessly, and staying open saves a trip to the trigger on
  // every adjustment — unlike the subdivision and time-signature pickers, which
  // have to be dismissed before the app is usable again. Escape closes at any
  // size, since that's a deliberate dismiss rather than an accidental one.
  useEffect(() => {
    if (!rampOpen) return;

    // Matches the 640px breakpoint in rampUp.css, where the panel goes
    // full-width — keep the two in step. `.matches` is live, so reading it at
    // event time also covers the window being resized while the panel is open.
    const narrow = window.matchMedia('(max-width: 640px)');

    // pointerdown rather than click: it fires for mouse, touch and pen alike,
    // and lands before a tap can activate whatever is underneath.
    const onPointerDown = (e: PointerEvent) => {
      if (!narrow.matches) return;
      const target = e.target as Element | null;
      // The trigger is excluded — it owns its own toggle, and closing here
      // first would make its click reopen the panel we just shut.
      if (target?.closest?.('.ramp, .ramp-toggle')) return;
      setRampOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRampOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [rampOpen]);

  const current = {
    bpm,
    timeSignature,
    pattern,
    subdivisions,
    ramp: tempoRamp,
  };
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

  // Scroll wheel over the slider nudges BPM (±10 with Shift). The readout's own
  // wheel/drag handling lives inside NumberField.
  const sliderWheelRef = useWheelAdjust<HTMLInputElement>((dir) =>
    setBpm(bpm + dir * step),
  );

  const [theme, setTheme] = useTheme();
  const [accent, setAccent] = useAccent(theme);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <button
        className="menu-toggle"
        onClick={() => {
          // The drawer covers the ramp panel, so don't leave it open behind it.
          setPresetsOpen((open) => {
            if (!open) setRampOpen(false);
            return !open;
          });
        }}
        aria-label="Toggle presets panel"
        aria-expanded={presetsOpen}
      >
        <span className="menu-icon" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>
      <button
        className="ramp-toggle"
        onClick={() => setRampOpen((open) => !open)}
        aria-label={
          tempoRamp.enabled
            ? `Tempo ramp: +${tempoRamp.stepBpm} BPM every ${tempoRamp.everyBars} bars. Toggle panel.`
            : 'Toggle tempo ramp panel'
        }
        aria-expanded={rampOpen}
        data-ramp-active={tempoRamp.enabled || undefined}
      >
        {/* Armed: show the settings, so a closed panel still says what's coming.
            Off: just the icon — there's nothing worth reporting. */}
        {tempoRamp.enabled ? (
          <span className="ramp-summary">
            +{tempoRamp.stepBpm}/{tempoRamp.everyBars}
          </span>
        ) : (
          <RampIcon />
        )}
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
      <aside
        className={`ramp ${rampOpen ? 'open' : ''}`}
        // When closed, `inert` removes the off-screen drawer from the tab order
        // and the accessibility tree, so its controls can't be focused or read.
        inert={!rampOpen}
      >
        <div className="ramp-content">
          <RampControl current={tempoRamp} onChange={setTempoRamp} />
        </div>
      </aside>

      <BrandHeader />

      <div
        className="metronome"
        data-ramp-warning={rampWarning || undefined}
        // Flips every beat, which is what re-triggers the warning pulse. A CSS
        // animation only restarts when its name changes, so the two alternating
        // names below are keyed off this. It also means the pulse can't outlive
        // the warning: both attributes change in the same render, so the rule
        // stops matching the instant the warning ends.
        data-beat-parity={beatTick % 2}
        // One beat's length, so the ramp warning can pulse in time rather than
        // on a fixed loop of its own. The warning flag is raised in the same
        // latency-compensated callback that advances the beat indicator, so the
        // animation starts on a beat and a one-beat cycle keeps it there.
        style={{ '--beat-seconds': `${60 / bpm}s` } as CSSProperties}
      >
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
              onToggle={toggle}
            />
            <div className="pendulum-readout">
              <NumberField
                className="tempo-field"
                name="Tempo"
                label="BPM"
                value={bpm}
                min={MIN_BPM}
                max={MAX_BPM}
                step={step}
                onChange={setBpm}
              />
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
                <div className="pendulum-ts-controls">
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

                <NumberField
                  className="tempo-field"
                  name="Tempo"
                  label="BPM"
                  value={bpm}
                  min={MIN_BPM}
                  max={MAX_BPM}
                  step={step}
                  onChange={setBpm}
                />

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
