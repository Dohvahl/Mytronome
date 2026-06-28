import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Expose the app version (from package.json) to the client as __APP_VERSION__.
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Tauri's devUrl is pinned to 5173. strictPort makes Vite fail loudly if the
  // port is taken (e.g. an orphaned dev server) instead of silently using 5174,
  // which Tauri wouldn't be watching. clearScreen:false keeps Tauri's logs visible.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
});
