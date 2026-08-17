// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Metronome } from '../../src/metronome/Metronome';
import { AuthProvider } from '../../src/auth/AuthContext';
import { DriveProvider } from '../../src/cloud/DriveContext';
import { resetDom, stubMatchMedia } from '../testDom';

/**
 * Which preset the header claims is loaded.
 *
 * `loadedPresetId` is the one piece of preset state the drawer doesn't own — it
 * lives in Metronome and is set from the load handler — so nothing below the
 * component can cover it, and the whole app is rendered here. That's cheaper
 * than it looks: WebAudioOutput builds its AudioContext lazily on the first
 * `resume()`, so a test that never presses Start never needs Web Audio at all.
 */

const PRESET_A = {
  id: 'preset-a',
  label: 'Verse',
  bpm: 120,
  timeSignature: { beats: 4, noteValue: 4 },
  pattern: ['accent', 'normal', 'normal', 'normal'],
  subdivisions: 1,
  createdAt: 1,
  updatedAt: 1,
};

function renderApp() {
  return render(
    <AuthProvider>
      <DriveProvider>
        <Metronome />
      </DriveProvider>
    </AuthProvider>,
  );
}

/** The header line naming the preset currently in play ('' when there is none). */
function loadedPresetLabel(): string {
  return document.querySelector('.loaded-preset')?.textContent?.trim() ?? '';
}

function toggleDrawer() {
  fireEvent.click(screen.getByRole('button', { name: /toggle presets/i }));
}

beforeEach(() => {
  resetDom();
  stubMatchMedia();
  localStorage.setItem('mytronome.presets', JSON.stringify([PRESET_A]));
});

afterEach(cleanup);

describe('the loaded-preset header', () => {
  it('names the preset just saved, replacing the one that was loaded', async () => {
    renderApp();
    toggleDrawer();

    // Load Verse first, so there is a loaded preset for the save to replace.
    fireEvent.click(await screen.findByRole('button', { name: /verse/i }));
    await waitFor(() => expect(loadedPresetLabel()).toBe('Verse'));

    // Saving builds a NEW preset out of the current settings, so that preset is
    // what's playing now and the header should name it. Leaving "Verse" up
    // misreports what's loaded, and flags it modified the moment anything moves.
    toggleDrawer();
    fireEvent.change(screen.getByPlaceholderText(/label \(optional\)/i), {
      target: { value: 'Chorus' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save preset/i }));

    await waitFor(() => expect(loadedPresetLabel()).toBe('Chorus'));
  });
});
