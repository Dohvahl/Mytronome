import { defineConfig } from 'vitest/config';

// Runs against the framework-agnostic packages and the web app's pure modules.
// Vitest bundles its own Vite, so this is independent of web's Vite version.
export default defineConfig({
  // Use the automatic JSX runtime so React component tests (.tsx) transform
  // without needing React in scope or @vitejs/plugin-react.
  esbuild: { jsx: 'automatic' },
  test: {
    // Default to Node; component tests opt into jsdom with a per-file
    // `// @vitest-environment jsdom` docblock.
    environment: 'node',
    include: [
      'metronome-engine/test/**/*.test.ts',
      'presets/test/**/*.test.ts',
      'web/test/**/*.test.{ts,tsx}',
    ],
  },
});
