// No JS-facing commands — the app calls this plugin from Rust via the
// GoogleDriveAuthExt trait, so nothing needs a capability permission.
const COMMANDS: &[&str] = &[];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .build();
}
