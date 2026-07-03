mod drive_auth;

use drive_auth::DriveState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // Native Google Drive authorization (Android Identity Services). Desktop
      // uses the loopback + PKCE flow in drive_auth.rs instead.
      #[cfg(mobile)]
      app.handle().plugin(tauri_plugin_google_drive_auth::init())?;
      Ok(())
    })
    .manage(DriveState::default())
    .invoke_handler(tauri::generate_handler![
      drive_auth::drive_is_configured,
      drive_auth::drive_is_connected,
      drive_auth::drive_connect,
      drive_auth::drive_get_access_token,
      drive_auth::drive_disconnect,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
