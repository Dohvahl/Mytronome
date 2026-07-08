use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::GoogleDriveAuth;
#[cfg(mobile)]
use mobile::GoogleDriveAuth;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the google-drive-auth APIs.
pub trait GoogleDriveAuthExt<R: Runtime> {
  fn google_drive_auth(&self) -> &GoogleDriveAuth<R>;
}

impl<R: Runtime, T: Manager<R>> crate::GoogleDriveAuthExt<R> for T {
  fn google_drive_auth(&self) -> &GoogleDriveAuth<R> {
    self.state::<GoogleDriveAuth<R>>().inner()
  }
}

/// Initializes the plugin. It exposes no JS commands — the app drives it from
/// Rust via the [`GoogleDriveAuthExt`] trait.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("google-drive-auth")
    .setup(|app, api| {
      #[cfg(mobile)]
      let google_drive_auth = mobile::init(app, api)?;
      #[cfg(desktop)]
      let google_drive_auth = desktop::init(app, api)?;
      app.manage(google_drive_auth);
      Ok(())
    })
    .build()
}
