use crate::repositories::api_keys::ApiKeyRepository;
use crate::AppState;
use tauri::State;
use chrono::Utc;

#[tauri::command]
pub fn set_api_key(state: State<AppState>, provider: String, key: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    ApiKeyRepository::set(&conn, &provider, &key, &now).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key(state: State<AppState>, provider: String) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    ApiKeyRepository::get(&conn, &provider).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_api_key(state: State<AppState>, provider: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    ApiKeyRepository::delete(&conn, &provider).map_err(|e| e.to_string())
}