use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<GoogleDriveAuth<R>> {
  Ok(GoogleDriveAuth(app.clone()))
}

/// Access to the google-drive-auth APIs.
pub struct GoogleDriveAuth<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> GoogleDriveAuth<R> {
  /// Desktop has its own loopback + PKCE Drive flow, so the native
  /// Authorization API isn't used here. Present only so the plugin compiles for
  /// all targets.
  pub fn authorize(&self, _payload: AuthorizeRequest) -> crate::Result<AuthorizeResponse> {
    Err(crate::Error::UnsupportedPlatform)
  }
}
