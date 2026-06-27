//! Google Drive OAuth for the desktop app.
//!
//! GIS (the web app's browser token flow) can't run in a webview, so on desktop
//! we do the Authorization-Code + PKCE flow natively: open the system browser
//! for consent, capture Google's redirect on a temporary loopback server, and
//! exchange the code here in Rust. The long-lived refresh token is kept in the
//! OS keychain; the webview only ever receives short-lived access tokens via
//! `drive_get_access_token`.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use oauth2::basic::BasicClient;
use oauth2::url::Url;
use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge, RedirectUrl,
    RefreshToken, Scope, TokenResponse, TokenUrl,
};
use tauri::State;
use tauri_plugin_oauth::{start_with_config, OauthConfig};

// Public app identifiers, injected at build time (see README/handoff), never
// committed — mirrors the web app's VITE_GOOGLE_CLIENT_ID. For Google "Desktop
// app" clients the secret is explicitly non-confidential and meant to be
// embedded, so option_env! baking it into the binary is acceptable.
const CLIENT_ID: Option<&str> = option_env!("MYTRONOME_GOOGLE_CLIENT_ID");
const CLIENT_SECRET: Option<&str> = option_env!("MYTRONOME_GOOGLE_CLIENT_SECRET");

const AUTH_URI: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URI: &str = "https://oauth2.googleapis.com/token";
const SCOPE: &str = "https://www.googleapis.com/auth/drive.appdata";

// Refresh token lives in the OS credential store under these keys.
const KEYRING_SERVICE: &str = "ca.dovall.mytronome";
const KEYRING_USER: &str = "google-drive-refresh-token";

/// Cached access token, held in memory only. Managed as Tauri state.
#[derive(Default)]
pub struct DriveState {
    cached: Mutex<Option<CachedToken>>,
}

struct CachedToken {
    access_token: String,
    expires_at: Instant,
}

fn client_id() -> Result<&'static str, String> {
    CLIENT_ID
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Google Drive isn't configured in this build.".to_string())
}

fn http_client() -> Result<reqwest::Client, String> {
    // Don't follow redirects: oauth2 recommends this to avoid SSRF.
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())
}

fn cache(state: &State<'_, DriveState>, access_token: String, expires_in: Duration) {
    // Renew a minute early to avoid edge-of-expiry failures.
    let expires_at = Instant::now() + expires_in.saturating_sub(Duration::from_secs(60));
    *state.cached.lock().unwrap() = Some(CachedToken {
        access_token,
        expires_at,
    });
}

// --- keychain helpers ------------------------------------------------------

fn store_refresh_token(token: &str) -> Result<(), String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .and_then(|e| e.set_password(token))
        .map_err(|e| format!("Couldn't save Drive credentials: {e}"))
}

fn load_refresh_token() -> Result<Option<String>, String> {
    match keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).and_then(|e| e.get_password()) {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Couldn't read Drive credentials: {e}")),
    }
}

fn delete_refresh_token() -> Result<(), String> {
    match keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).and_then(|e| e.delete_credential()) {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Couldn't clear Drive credentials: {e}")),
    }
}

// --- commands --------------------------------------------------------------

/// True when this build has a client id baked in (so the UI can hide the option
/// otherwise) — parallels the web app's `isDriveConfigured`.
#[tauri::command]
pub fn drive_is_configured() -> bool {
    CLIENT_ID.map(|s| !s.is_empty()).unwrap_or(false)
}

/// True when a refresh token is stored (i.e. previously connected).
#[tauri::command]
pub fn drive_is_connected() -> bool {
    load_refresh_token().ok().flatten().is_some()
}

/// Run the full consent flow: loopback + system browser + PKCE exchange, then
/// persist the refresh token. Call from a user click.
#[tauri::command]
pub async fn drive_connect(state: State<'_, DriveState>) -> Result<(), String> {
    let client_id = client_id()?;
    let client_secret = CLIENT_SECRET.unwrap_or("");

    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    // Spin up the loopback server first so we know which port to redirect to.
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(1);
    let config = OauthConfig {
        ports: None, // let the plugin pick a free port
        response: Some(
            "Mytronome is now connected to Google Drive. You can close this tab.".into(),
        ),
    };
    let port = start_with_config(config, move |url| {
        // Ignore unrelated hits (e.g. favicon); only forward the real redirect.
        if url.contains("code=") || url.contains("error=") {
            let _ = tx.blocking_send(url);
        }
    })
    .map_err(|e| format!("Couldn't start the local sign-in server: {e}"))?;

    let redirect_uri = format!("http://127.0.0.1:{port}");
    let client = BasicClient::new(ClientId::new(client_id.to_string()))
        .set_client_secret(ClientSecret::new(client_secret.to_string()))
        .set_auth_uri(AuthUrl::new(AUTH_URI.to_string()).map_err(|e| e.to_string())?)
        .set_token_uri(TokenUrl::new(TOKEN_URI.to_string()).map_err(|e| e.to_string())?)
        .set_redirect_uri(RedirectUrl::new(redirect_uri).map_err(|e| e.to_string())?);

    let (auth_url, csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new(SCOPE.to_string()))
        // access_type=offline + prompt=consent guarantees a refresh token.
        .add_extra_param("access_type", "offline")
        .add_extra_param("prompt", "consent")
        .set_pkce_challenge(pkce_challenge)
        .url();

    open::that(auth_url.to_string()).map_err(|e| format!("Couldn't open the browser: {e}"))?;

    // Wait for the redirect, then free the port either way.
    let redirect = tokio::time::timeout(Duration::from_secs(300), rx.recv()).await;
    let _ = tauri_plugin_oauth::cancel(port);
    let redirect = redirect
        .map_err(|_| "Timed out waiting for Google sign-in.".to_string())?
        .ok_or_else(|| "Sign-in was cancelled.".to_string())?;

    // Parse the redirect for code + state, and verify state (CSRF guard).
    let parsed = Url::parse(&redirect).map_err(|e| e.to_string())?;
    let mut code = None;
    let mut returned_state = None;
    for (key, value) in parsed.query_pairs() {
        match key.as_ref() {
            "code" => code = Some(value.into_owned()),
            "state" => returned_state = Some(value.into_owned()),
            "error" => return Err(format!("Google denied access: {value}")),
            _ => {}
        }
    }
    let code = code.ok_or_else(|| "No authorization code in the redirect.".to_string())?;
    if returned_state.as_deref() != Some(csrf_token.secret().as_str()) {
        return Err("Sign-in state mismatch — aborting for safety.".to_string());
    }

    // Exchange the code (+ PKCE verifier) for tokens.
    let http = http_client()?;
    let token = client
        .exchange_code(AuthorizationCode::new(code))
        .set_pkce_verifier(pkce_verifier)
        .request_async(&http)
        .await
        .map_err(|e| format!("Token exchange failed: {e}"))?;

    let refresh = token
        .refresh_token()
        .ok_or_else(|| "Google didn't return a refresh token.".to_string())?
        .secret()
        .to_string();
    store_refresh_token(&refresh)?;

    let expires_in = token.expires_in().unwrap_or(Duration::from_secs(3600));
    cache(&state, token.access_token().secret().to_string(), expires_in);
    Ok(())
}

/// Return a valid access token, refreshing via the stored refresh token when the
/// cached one has expired. This is the seam the JS `getAccessToken()` calls.
#[tauri::command]
pub async fn drive_get_access_token(state: State<'_, DriveState>) -> Result<String, String> {
    // Fast path: a still-valid cached token.
    if let Some(cached) = state.cached.lock().unwrap().as_ref() {
        if Instant::now() < cached.expires_at {
            return Ok(cached.access_token.clone());
        }
    }

    let refresh =
        load_refresh_token()?.ok_or_else(|| "Not connected to Google Drive.".to_string())?;
    let client_id = client_id()?;
    let client_secret = CLIENT_SECRET.unwrap_or("");

    let client = BasicClient::new(ClientId::new(client_id.to_string()))
        .set_client_secret(ClientSecret::new(client_secret.to_string()))
        .set_auth_uri(AuthUrl::new(AUTH_URI.to_string()).map_err(|e| e.to_string())?)
        .set_token_uri(TokenUrl::new(TOKEN_URI.to_string()).map_err(|e| e.to_string())?);

    let http = http_client()?;
    let token = client
        .exchange_refresh_token(&RefreshToken::new(refresh))
        .request_async(&http)
        .await
        .map_err(|e| format!("Couldn't refresh Google access: {e}"))?;

    let access_token = token.access_token().secret().to_string();
    let expires_in = token.expires_in().unwrap_or(Duration::from_secs(3600));
    cache(&state, access_token.clone(), expires_in);
    Ok(access_token)
}

/// Forget the connection: clear the cached token and remove the stored refresh
/// token. (Server-side token revocation is a follow-up.)
#[tauri::command]
pub fn drive_disconnect(state: State<'_, DriveState>) -> Result<(), String> {
    *state.cached.lock().unwrap() = None;
    delete_refresh_token()
}
