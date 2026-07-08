//! Google Drive OAuth for the Tauri app (desktop + mobile).
//!
//! The two platforms take completely different routes, because Google no longer
//! allows a browser-redirect OAuth flow for Android (custom-scheme and loopback
//! redirects are both blocked for Android clients):
//!   - DESKTOP: hand-rolled Authorization-Code + PKCE over a loopback redirect,
//!     token exchange in Rust, refresh token in the OS keychain (`keyring`).
//!   - MOBILE: the native Android Authorization API (Google Identity Services)
//!     via the `google-drive-auth` plugin — access tokens only, NO refresh token,
//!     nothing stored on device (Google remembers the grant). The Android OAuth
//!     client is matched by package + SHA-1, so no client id/secret is baked in.
//!
//! Both platforms expose the same commands, so the JS `getAccessToken()` seam is
//! identical and `googleDrivePresetStore` (Drive REST in JS) is unchanged.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::State;
#[cfg(mobile)]
use tauri::AppHandle;

// ---- Desktop-only OAuth machinery (loopback redirect + PKCE + keychain) ----
#[cfg(desktop)]
use oauth2::basic::BasicClient;
#[cfg(desktop)]
use oauth2::url::Url;
#[cfg(desktop)]
use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge, RedirectUrl,
    RefreshToken, Scope, TokenResponse, TokenUrl,
};
#[cfg(desktop)]
use tauri_plugin_oauth::{start_with_config, OauthConfig};

// ---- Mobile-only: the native authorization plugin ----
#[cfg(mobile)]
use tauri_plugin_google_drive_auth::{AuthorizeRequest, GoogleDriveAuthExt};

// Desktop OAuth client identifiers, baked at build time (see README/handoff),
// never committed. Mobile's native flow doesn't use them.
#[cfg(desktop)]
const CLIENT_ID: Option<&str> = option_env!("MYTRONOME_GOOGLE_CLIENT_ID");
#[cfg(desktop)]
const CLIENT_SECRET: Option<&str> = option_env!("MYTRONOME_GOOGLE_CLIENT_SECRET");

#[cfg(desktop)]
const AUTH_URI: &str = "https://accounts.google.com/o/oauth2/v2/auth";
#[cfg(desktop)]
const TOKEN_URI: &str = "https://oauth2.googleapis.com/token";

const SCOPE: &str = "https://www.googleapis.com/auth/drive.appdata";

// Refresh token lives in the OS keychain (desktop only) under these keys.
#[cfg(desktop)]
const KEYRING_SERVICE: &str = "ca.dovall.mytronome";
#[cfg(desktop)]
const KEYRING_USER: &str = "google-drive-refresh-token";

/// Cached access token, held in memory only. Managed as Tauri state. On desktop
/// it holds the token from the last refresh; on mobile it caches the token the
/// native API hands back, to avoid a plugin round-trip on every Drive call.
#[derive(Default)]
pub struct DriveState {
    cached: Mutex<Option<CachedToken>>,
}

struct CachedToken {
    access_token: String,
    expires_at: Instant,
}

fn cache(state: &State<'_, DriveState>, access_token: String, expires_in: Duration) {
    // Renew a minute early to avoid edge-of-expiry failures.
    let expires_at = Instant::now() + expires_in.saturating_sub(Duration::from_secs(60));
    *state.cached.lock().unwrap() = Some(CachedToken {
        access_token,
        expires_at,
    });
}

#[cfg(desktop)]
fn client_id() -> Result<&'static str, String> {
    CLIENT_ID
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Google Drive isn't configured in this build.".to_string())
}

#[cfg(desktop)]
fn http_client() -> Result<reqwest::Client, String> {
    // Don't follow redirects: oauth2 recommends this to avoid SSRF.
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())
}

// --- desktop token storage (OS keychain) -----------------------------------

#[cfg(desktop)]
mod token_store {
    use super::{KEYRING_SERVICE, KEYRING_USER};

    pub fn store(token: &str) -> Result<(), String> {
        keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
            .and_then(|e| e.set_password(token))
            .map_err(|e| format!("Couldn't save Drive credentials: {e}"))
    }

    pub fn load() -> Result<Option<String>, String> {
        match keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).and_then(|e| e.get_password()) {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Couldn't read Drive credentials: {e}")),
        }
    }

    pub fn delete() -> Result<(), String> {
        match keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).and_then(|e| e.delete_credential())
        {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Couldn't clear Drive credentials: {e}")),
        }
    }
}

// --- commands: is-configured / is-connected --------------------------------

/// True when Drive can be offered. Desktop needs a baked client id; mobile always
/// supports it via the native SDK (assuming the Console Android client is set up).
#[cfg(desktop)]
#[tauri::command]
pub fn drive_is_configured() -> bool {
    CLIENT_ID.map(|s| !s.is_empty()).unwrap_or(false)
}

#[cfg(mobile)]
#[tauri::command]
pub fn drive_is_configured() -> bool {
    true
}

/// True when previously connected. Desktop checks the stored refresh token; mobile
/// has no on-device state, so this reflects only the in-session cache (the JS layer
/// keeps the persistent "connected" hint in localStorage).
#[cfg(desktop)]
#[tauri::command]
pub fn drive_is_connected() -> bool {
    token_store::load().ok().flatten().is_some()
}

#[cfg(mobile)]
#[tauri::command]
pub fn drive_is_connected(state: State<'_, DriveState>) -> bool {
    state.cached.lock().unwrap().is_some()
}

// --- commands: connect -----------------------------------------------------

/// Desktop consent flow: loopback + system browser + PKCE exchange, then persist
/// the refresh token. Call from a user click.
#[cfg(desktop)]
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
    token_store::store(&refresh)?;

    let expires_in = token.expires_in().unwrap_or(Duration::from_secs(3600));
    cache(&state, token.access_token().secret().to_string(), expires_in);
    Ok(())
}

/// Mobile consent flow: the native Android Authorization API. Shows the native
/// consent dialog the first time; the returned access token is cached.
#[cfg(mobile)]
#[tauri::command]
pub async fn drive_connect(app: AppHandle, state: State<'_, DriveState>) -> Result<(), String> {
    let token = app
        .google_drive_auth()
        .authorize(AuthorizeRequest {
            scopes: Some(vec![SCOPE.to_string()]),
        })
        .map_err(|e| e.to_string())?
        .access_token;
    cache(&state, token, MOBILE_TOKEN_TTL);
    Ok(())
}

// --- commands: get access token --------------------------------------------

/// Desktop: return a valid access token, refreshing via the stored refresh token
/// when the cached one has expired.
#[cfg(desktop)]
#[tauri::command]
pub async fn drive_get_access_token(state: State<'_, DriveState>) -> Result<String, String> {
    if let Some(cached) = state.cached.lock().unwrap().as_ref() {
        if Instant::now() < cached.expires_at {
            return Ok(cached.access_token.clone());
        }
    }

    let refresh =
        token_store::load()?.ok_or_else(|| "Not connected to Google Drive.".to_string())?;
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

/// Mobile: return a valid access token from the cache, or ask the native
/// Authorization API for a fresh one (silent while the grant is still valid).
#[cfg(mobile)]
#[tauri::command]
pub async fn drive_get_access_token(
    app: AppHandle,
    state: State<'_, DriveState>,
) -> Result<String, String> {
    if let Some(cached) = state.cached.lock().unwrap().as_ref() {
        if Instant::now() < cached.expires_at {
            return Ok(cached.access_token.clone());
        }
    }

    let token = app
        .google_drive_auth()
        .authorize(AuthorizeRequest {
            scopes: Some(vec![SCOPE.to_string()]),
        })
        .map_err(|e| e.to_string())?
        .access_token;
    cache(&state, token.clone(), MOBILE_TOKEN_TTL);
    Ok(token)
}

// --- commands: disconnect --------------------------------------------------

/// Desktop: clear the cached token and remove the stored refresh token.
/// (Server-side token revocation is a follow-up.)
#[cfg(desktop)]
#[tauri::command]
pub fn drive_disconnect(state: State<'_, DriveState>) -> Result<(), String> {
    *state.cached.lock().unwrap() = None;
    token_store::delete()
}

/// Mobile: nothing is stored on device, so just drop the cached token. The grant
/// itself lives in the Google account (revoking it is a follow-up).
#[cfg(mobile)]
#[tauri::command]
pub fn drive_disconnect(state: State<'_, DriveState>) -> Result<(), String> {
    *state.cached.lock().unwrap() = None;
    Ok(())
}

// Google access tokens last ~1h; the native API doesn't hand us the exact expiry,
// so we cache conservatively and let the next call re-authorize silently.
#[cfg(mobile)]
const MOBILE_TOKEN_TTL: Duration = Duration::from_secs(50 * 60);
