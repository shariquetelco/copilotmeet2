use crate::repositories::settings::SettingsRepository;
use crate::AppState;
use tauri::State;
use chrono::Utc;
use std::collections::HashMap;

#[tauri::command]
pub fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    SettingsRepository::get(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    SettingsRepository::set(&conn, &key, &value, &now).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_settings(state: State<AppState>) -> Result<HashMap<String, String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    SettingsRepository::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_setting(state: State<AppState>, key: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    SettingsRepository::delete(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn optimize_database(state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("VACUUM;").map_err(|e| e.to_string())
}