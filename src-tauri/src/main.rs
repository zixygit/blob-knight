// idea 95: Tauri entry point — wraps the Vite build in a desktop window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running EmberQuest 2D");
}