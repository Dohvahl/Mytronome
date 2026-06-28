/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the preset API. Defaults to http://localhost:5046. */
  readonly VITE_API_BASE_URL?: string;
  /** Google OAuth client id (public) for Drive sync. Empty disables the option. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Set to "true" to enable the server/accounts tier (sign-in + Server storage). */
  readonly VITE_ENABLE_SERVER?: string;
}

/** Injected by Vite (see vite.config.ts) — the app version from web/package.json. */
declare const __APP_VERSION__: string;
