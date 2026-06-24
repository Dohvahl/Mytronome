import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { DriveProvider } from './cloud/DriveContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <DriveProvider>
        <App />
      </DriveProvider>
    </AuthProvider>
  </StrictMode>,
)
