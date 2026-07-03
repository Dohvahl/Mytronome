use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_google_drive_auth);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<GoogleDriveAuth<R>> {
  #[cfg(target_os = "android")]
  let handle =
    api.register_android_plugin("ca.dovall.mytronome.plugin.drive", "DriveAuthPlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_google_drive_auth)?;
  Ok(GoogleDriveAuth(handle))
}

/// Access to the google-drive-auth APIs.
pub struct GoogleDriveAuth<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> GoogleDriveAuth<R> {
  /// Request an access token for the given scopes via the native Android
  /// Authorization API. Shows a consent dialog the first time; returns silently
  /// afterwards while the grant is still valid.
  pub fn authorize(&self, payload: AuthorizeRequest) -> crate::Result<AuthorizeResponse> {
    self
      .0
      .run_mobile_plugin("authorize", payload)
      .map_err(Into::into)
  }
}
