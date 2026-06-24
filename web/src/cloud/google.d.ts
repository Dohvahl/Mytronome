// Minimal types for the Google Identity Services token client we use.

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  callback: (response: GoogleTokenResponse) => void;
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface GoogleNamespace {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
      }): GoogleTokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

interface Window {
  google?: GoogleNamespace;
}
