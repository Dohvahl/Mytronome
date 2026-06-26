import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri's devUrl is pinned to 5173. strictPort makes Vite fail loudly if the
  // port is taken (e.g. an orphaned dev server) instead of silently using 5174,
  // which Tauri wouldn't be watching. clearScreen:false keeps Tauri's logs visible.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
});
