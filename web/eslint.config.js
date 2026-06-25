import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // A Provider and its hook intentionally live in one file; this is a
      // fast-refresh (HMR) concern only, not a runtime issue. Keep it visible
      // as a warning rather than failing the build.
      'react-refresh/only-export-components': 'warn',
      // The effects flagged by this rule here (data loading in usePresets,
      // controlled-input draft sync in TempoControl) are intentional state
      // synchronization. Keep the hint as a warning, not a build failure.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
