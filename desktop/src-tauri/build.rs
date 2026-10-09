fn main() {
    // install_update is the one command the app's pages may call (capability added at start).
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["install_update"])),
    )
    .expect("the Tauri build step failed");
}
