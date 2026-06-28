fn main() {
  // The Google client id/secret are read via option_env! and baked into the
  // binary; tell cargo to rebuild when they change (it won't otherwise notice).
  println!("cargo:rerun-if-env-changed=MYTRONOME_GOOGLE_CLIENT_ID");
  println!("cargo:rerun-if-env-changed=MYTRONOME_GOOGLE_CLIENT_SECRET");
  tauri_build::build()
}
