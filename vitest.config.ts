import { defineConfig } from 'vitest/config';

// Runs against the framework-agnostic packages and the web app's pure modules.
// Vitest bundles its own Vite, so this is independent of web's Vite version.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'metronome-engine/test/**/*.test.ts',
      'presets/test/**/*.test.ts',
      'web/test/**/*.test.ts',
    ],
  },
});
