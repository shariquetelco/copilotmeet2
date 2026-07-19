use crate::repositories::document::{Document, DocumentRepository};
use crate::repositories::document_job::{DocumentJob, DocumentJobRepository};
use crate::rag_engine;
use crate::rag_engine::vector_store::SearchResult;
use crate::rag_engine::embed;
use crate::AppState;
use tauri::{State, Manager, AppHandle};
use uuid::Uuid;
use chrono::Utc;
use std::fs;
use std::path::PathBuf;

const FREE_TIER_PROJECT_BYTES: i64 = 5 * 1024 * 1024; // 5MB, per PRD
// Premium tier (200MB) will be selected based on real license status once
// license activation exists — logged as a MAJOR gap for the Windows session.

#[tauri::command]
pub fn upload_document(
    app: AppHandle,
    state: State<AppState>,
    project_id: String,
    source_path: String,
) -> Result<Document, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err("Selected file no longer exists".into());
    }

    let metadata = fs::metadata(&source).map_err(|e| e.to_string())?;

    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let current_usage = DocumentRepository::total_size_for_project(&conn, &project_id)
            .map_err(|e| e.to_string())?;

        if current_usage + metadata.len() as i64 > FREE_TIER_PROJECT_BYTES {
            return Err(format!(
                "Storage Limit Reached: this project has used {:.1} MB of its 5 MB limit. Remove documents or upgrade to Premium to continue uploading.",
                current_usage as f64 / (1024.0 * 1024.0)
            ));
        }
    }

    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid file name")?
        .to_string();

    let file_type = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown")
        .to_uppercase();

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let project_dir = app_data_dir.join("documents").join(&project_id);
    fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;

    let doc_id = Uuid::new_v4().to_string();
    let dest_file_name = format!("{}_{}", doc_id, file_name);
    let dest_path = project_dir.join(&dest_file_name);

    fs::copy(&source, &dest_path).map_err(|e| e.to_string())?;

    let doc = Document {
        id: doc_id,
        project_id,
        file_name,
        file_path: dest_path.to_string_lossy().to_string(),
        file_size_bytes: metadata.len() as i64,
        file_type,
        status: "uploaded".to_string(),
        created_at: Utc::now().to_rfc3339(),
    };

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    DocumentRepository::create(&conn, &doc).map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();
    let job = DocumentJob {
        id: Uuid::new_v4().to_string(),
        document_id: doc.id.clone(),
        stage: "pending".to_string(),
        error: None,
        created_at: now.clone(),
        updated_at: now,
    };
    DocumentJobRepository::create(&conn, &job).map_err(|e| e.to_string())?;

    // Synchronous for now — real background threading arrives once
    // slower extraction types (PDF/OCR) make blocking noticeable.
    rag_engine::process_document(&conn, &doc, &app_data_dir)?;

    Ok(doc)
}

#[tauri::command]
pub fn list_documents(state: State<AppState>, project_id: String) -> Result<Vec<Document>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    DocumentRepository::list_by_project(&conn, &project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project_storage(state: State<AppState>, project_id: String) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    DocumentRepository::total_size_for_project(&conn, &project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_document_job(state: State<AppState>, document_id: String) -> Result<Option<DocumentJob>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    DocumentJobRepository::get_by_document(&conn, &document_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_documents(
    app: AppHandle,
    project_id: String,
    query: String,
    top_k: usize,
) -> Result<Vec<SearchResult>, String> {
    let query_embeddings = embed::embed_texts(&[query])?;
    let query_vector = query_embeddings.get(0).ok_or("Failed to embed query")?;

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("lancedb").to_string_lossy().to_string();

    rag_engine::vector_store::search(&db_path, query_vector, Some(&project_id), top_k)
}

#[tauri::command]
pub fn build_answer_prompt(
    app: AppHandle,
    project_id: String,
    question: String,
    answer_style: String,
    meeting_mode: String,
) -> Result<String, String> {
    let embed_start = std::time::Instant::now();
    let query_embeddings = embed::embed_texts(&[question.clone()])?;
    let query_vector = query_embeddings.get(0).ok_or("Failed to embed query")?;
    println!("Embedding: {}ms", embed_start.elapsed().as_millis());

    let search_start = std::time::Instant::now();
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("lancedb").to_string_lossy().to_string();
    let results = rag_engine::vector_store::search(&db_path, query_vector, Some(&project_id), 1)?;
    println!("Vector Search: {}ms", search_start.elapsed().as_millis());

    let context = results
        .get(0)
        .map(|r| r.content.clone())
        .unwrap_or_else(|| "No relevant information found in the uploaded documents.".to_string());

    let build_start = std::time::Instant::now();
    let prompt = rag_engine::prompt_builder::build_prompt(&rag_engine::prompt_builder::PromptContext {
        question,
        context,
        answer_style,
        meeting_mode,
    });
    println!("Prompt Build: {}ms", build_start.elapsed().as_millis());

    Ok(prompt)
}

#[tauri::command]
pub fn delete_document(state: State<AppState>, id: String, file_path: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    DocumentRepository::delete(&conn, &id).map_err(|e| e.to_string())?;

    // best-effort file cleanup; don't fail the whole operation if this errors
    let _ = fs::remove_file(&file_path);

    Ok(())
}