mod db;
mod repositories;
mod commands;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

use commands::project::{create_project, list_projects, update_project, delete_project};

pub struct AppState {
    pub db: Mutex<Connection>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            let conn = db::init_db(&app_data_dir)
                .expect("Failed to initialize database");

            app.manage(AppState {
                db: Mutex::new(conn),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            create_project,
            list_projects,
            update_project,
            delete_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}