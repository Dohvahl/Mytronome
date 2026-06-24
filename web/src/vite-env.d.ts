/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the preset API. Defaults to http://localhost:5046. */
  readonly VITE_API_BASE_URL?: string;
  /** Google OAuth client id (public) for Drive sync. Empty disables the option. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
