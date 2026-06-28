import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './theme/themes.css';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthContext';
import { DriveProvider } from './cloud/DriveContext';
import { applyTheme, readSavedTheme } from './theme/useTheme';

// Apply the saved theme before first paint so there's no flash of the default.
applyTheme(readSavedTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <DriveProvider>
        <App />
      </DriveProvider>
    </AuthProvider>
  </StrictMode>,
);
