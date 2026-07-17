use crate::repositories::project::{Project, ProjectRepository};
use crate::AppState;
use tauri::State;
use uuid::Uuid;
use chrono::Utc;

#[tauri::command]
pub fn create_project(
    state: State<AppState>,
    name: String,
    meeting_mode: String,
) -> Result<Project, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let project = Project {
        id: Uuid::new_v4().to_string(),
        name,
        meeting_mode,
        llm_profile: None,
        is_active: false,
        created_at: now.clone(),
        updated_at: now,
    };

    ProjectRepository::create(&conn, &project).map_err(|e| e.to_string())?;
    Ok(project)
}

#[tauri::command]
pub fn list_projects(state: State<AppState>) -> Result<Vec<Project>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    ProjectRepository::list(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_project(
    state: State<AppState>,
    project: Project,
) -> Result<Project, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut updated = project;
    updated.updated_at = Utc::now().to_rfc3339();

    ProjectRepository::update(&conn, &updated).map_err(|e| e.to_string())?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_project(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    ProjectRepository::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_active_project(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    ProjectRepository::set_active(&conn, &id, &now).map_err(|e| e.to_string())
}