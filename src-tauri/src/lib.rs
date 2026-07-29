mod db;
mod repositories;
mod commands;
mod rag_engine;
mod llm_engine;
mod question_engine;
mod audio_engine;
mod stt_engine;
mod license;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

use commands::project::{create_project, list_projects, update_project, delete_project, set_active_project};
use commands::settings::{get_setting, set_setting, get_all_settings, delete_setting, optimize_database};
use commands::api_keys::{set_api_key, get_api_key, delete_api_key};
use commands::document::{upload_document, list_documents, delete_document, get_project_storage, get_document_job, search_documents, build_answer_prompt, ask_pet};

pub struct AppState {
    pub db: Mutex<Connection>,
    pub audio_session: Mutex<Option<AudioSession>>,
    pub current_session_id: Mutex<Option<String>>,
}

pub struct AudioSession {
    pub stop_capture: Box<dyn Fn() + Send + Sync>,
    pub tasks: Vec<tokio::task::JoinHandle<()>>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn test_audio_loopback() -> Result<String, String> {
    let bytes = audio_engine::loopback::test_capture(5)?;
    Ok(format!("Captured {} bytes in 5 seconds", bytes))
}

#[tauri::command]
async fn get_license_status(state: State<'_, AppState>) -> Result<license::mode::AppMode, String> {
    use license::status::*;
    use license::verify::{check_token, TokenCheckResult};

    let token = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        match read_token(&conn) {
            Some(t) => t,
            None => return Ok(license::mode::AppMode::ActivationRequired),
        }
    };

    match check_token(&token) {
        TokenCheckResult::Valid(claims) => Ok(mode_from_claims(&claims)),
        TokenCheckResult::Invalid => Ok(license::mode::AppMode::ActivationRequired),
        TokenCheckResult::Expired(claims) => {
            if claims.token_type == "trial" {
                return Ok(license::mode::AppMode::Locked {
                    reason: "Your trial has ended. Please purchase a license.".to_string(),
                });
            }

            let device_id = license::fingerprint::get_device_fingerprint()?;
            let license_id = claims.license_id.clone().unwrap_or_default();
            let token_version = claims.token_version.unwrap_or(1);

            match license::client::check(&license_id, &device_id, token_version).await {
                Ok(new_token) => {
                    let conn = state.db.lock().map_err(|e| e.to_string())?;
                    store_token(&conn, &new_token)?;
                    match check_token(&new_token) {
                        TokenCheckResult::Valid(new_claims) => Ok(mode_from_claims(&new_claims)),
                        _ => Ok(license::mode::AppMode::ActivationRequired),
                    }
                }
                Err(e) => {
                    if e.contains("Network error") {
                        let last_verified = {
                            let conn = state.db.lock().map_err(|e| e.to_string())?;
                            read_last_verified(&conn)
                        };
                        let days_since = (now_secs() - last_verified) / 86400;
                        let days_remaining = GRACE_DAYS - days_since;

                        if days_remaining > 0 {
                            Ok(license::mode::AppMode::Grace { days_remaining })
                        } else {
                            Ok(license::mode::AppMode::Locked {
                                reason: "Offline grace period expired. Please reconnect to verify your license.".to_string(),
                            })
                        }
                    } else {
                        Ok(license::mode::AppMode::Locked { reason: e })
                    }
                }
            }
        }
    }
}

#[tauri::command]
async fn activate_license(state: State<'_, AppState>, license_key: String) -> Result<license::mode::AppMode, String> {
    use license::status::*;
    use license::verify::{check_token, TokenCheckResult};

    let device_id = license::fingerprint::get_device_fingerprint()?;
    let token = license::client::activate(&license_key, &device_id).await?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    store_token(&conn, &token)?;
    // Stored purely for masked display in Settings — never sent anywhere,
    // the JWT itself deliberately never carries the raw key.
    let _ = crate::repositories::settings::SettingsRepository::set(
        &conn,
        "license.key",
        &license_key,
        &now_secs().to_string(),
    );

    match check_token(&token) {
        TokenCheckResult::Valid(claims) => Ok(mode_from_claims(&claims)),
        _ => Err("Received an invalid token from the server".to_string()),
    }
}

#[derive(serde::Serialize)]
struct LicenseDetails {
    mode: String,
    license_id: Option<String>,
    plan: Option<String>,
    email: Option<String>,
    max_devices: Option<u32>,
    activation_count: Option<u32>,
    masked_key: Option<String>,
    last_verified_at: Option<i64>,
    expires_at: Option<usize>,
    deepgram_source: Option<String>,
    groq_source: Option<String>,
}

fn provider_source(conn: &rusqlite::Connection, provider: &str, is_trial: bool) -> String {
    if is_trial {
        return "Trial (funded by CopilotMeet)".to_string();
    }
    let has_byok = crate::repositories::api_keys::ApiKeyRepository::get(conn, provider)
        .ok()
        .flatten()
        .is_some();
    if has_byok {
        "Your own key (BYOK)".to_string()
    } else {
        "Prepaid Credits".to_string()
    }
}

#[tauri::command]
async fn test_broker_token(trial_session_id: String) -> Result<license::broker::DeepgramTokenResponse, String> {
    let identity = license::broker::BrokerIdentity::Trial(trial_session_id);
    license::broker::request_deepgram_token(&identity).await
}

#[tauri::command]
fn get_qa_history(state: State<AppState>, project_id: String, limit: u32) -> Result<Vec<repositories::qa_entry::QaEntry>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    repositories::qa_entry::QaEntryRepository::list_by_project(&conn, &project_id, limit)
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct ProjectKnowledgeStats {
    document_count: usize,
    word_count: usize,
    ready_to_train: bool,
}

/// The real gate for "Train CoPilot Project" — document count OR word
/// count, never MB. A 20MB scan can have almost no usable text; a 3MB
/// set of clean transcripts can have tens of thousands of words. Only
/// the actual extracted content tells you if there's enough to work with.
#[derive(serde::Serialize)]
struct TrainingReport {
    project_name: String,
    document_count: usize,
    word_count: usize,
    keyterm_count: usize,
    summary: String,
    generated_at: String,
}

/// The real work behind "Train CoPilot Project": free local statistics
/// (word/document counts, keyword extraction — already built, zero cost)
/// plus exactly one bounded LLM call to pull out a project summary and
/// highlights from a sample of the actual content. Not per-document, one
/// call total, to keep cost predictable regardless of project size.
#[derive(serde::Serialize)]
struct PersonalizationScore {
    score: u32,
    project_trained: bool,
    personal_profile_exists: bool,
    document_count: usize,
    word_count: usize,
    new_document_count: usize,
}

#[tauri::command]
fn get_personalization_score(state: State<AppState>, project_id: String) -> Result<PersonalizationScore, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let brief = repositories::settings::SettingsRepository::get(&conn, &format!("project_brief.{}", project_id))
        .ok()
        .flatten()
        .and_then(|json| serde_json::from_str::<serde_json::Value>(&json).ok());

    let project_trained = brief.is_some();

    let personal_profile_exists = repositories::settings::SettingsRepository::get(&conn, "personal_profile")
        .ok()
        .flatten()
        .is_some();

    let documents: Vec<_> = repositories::document::DocumentRepository::list_by_project(&conn, &project_id)
        .map_err(|e| e.to_string())?
        .into_iter()
        .filter(|d| d.status == "ready")
        .collect();
    let document_count = documents.len();

    let chunks = repositories::chunk::ChunkRepository::list_by_project(&conn, &project_id)
        .map_err(|e| e.to_string())?;
    let word_count: usize = chunks.iter().map(|c| c.content.split_whitespace().count()).sum();

    let trained_ids: std::collections::HashSet<String> = brief
        .as_ref()
        .and_then(|v| v["document_ids"].as_array().cloned())
        .map(|arr| arr.into_iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();
    let current_ids: std::collections::HashSet<String> = documents.iter().map(|d| d.id.clone()).collect();
    let new_document_count = current_ids.difference(&trained_ids).count();

    let mut score: i32 = 0;
    if project_trained {
        score += 40;
    }
    if personal_profile_exists {
        score += 20;
    }
    score += ((document_count as f32 / 20.0).min(1.0) * 20.0) as i32;
    score += ((word_count as f32 / 20000.0).min(1.0) * 20.0) as i32;
    if project_trained && new_document_count > 0 {
        score -= 10;
    }
    let score = score.clamp(0, 100) as u32;

    Ok(PersonalizationScore {
        score,
        project_trained,
        personal_profile_exists,
        document_count,
        word_count,
        new_document_count,
    })
}

fn wrap_text(text: &str, max_chars: usize) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in text.split_whitespace() {
        if current.len() + word.len() + 1 > max_chars {
            lines.push(current.clone());
            current.clear();
        }
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }
    if !current.is_empty() {
        lines.push(current);
    }
    lines
}

#[tauri::command]
fn export_project_brief_pdf(state: State<AppState>, project_id: String, output_path: String) -> Result<(), String> {
    use printpdf::*;
    use std::fs::File;
    use std::io::BufWriter;

    let (brief, score, project_name) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;

        let brief = repositories::settings::SettingsRepository::get(&conn, &format!("project_brief.{}", project_id))
            .ok()
            .flatten()
            .and_then(|json| serde_json::from_str::<serde_json::Value>(&json).ok())
            .ok_or("This project hasn't been trained yet.")?;

        let name = repositories::project::ProjectRepository::list(&conn)
            .ok()
            .and_then(|projects| projects.into_iter().find(|p| p.id == project_id))
            .map(|p| p.name)
            .unwrap_or_else(|| "Untitled Project".to_string());

        (brief, None::<u32>, name)
    };

    let score_value = get_personalization_score(state, project_id.clone())?;

    let (doc, page1, layer1) = PdfDocument::new(
        &format!("{} - Project Intelligence Report", project_name),
        Mm(210.0),
        Mm(297.0),
        "Layer 1",
    );
    let font = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| e.to_string())?;
    let bold = doc.add_builtin_font(BuiltinFont::HelveticaBold).map_err(|e| e.to_string())?;
    let layer = doc.get_page(page1).get_layer(layer1);

    let mut y = 270.0;
    layer.use_text(&project_name, 22.0, Mm(20.0), Mm(y), &bold);
    y -= 8.0;
    layer.use_text("Project Intelligence Report", 12.0, Mm(20.0), Mm(y), &font);
    y -= 12.0;

    layer.use_text("Knowledge Score", 14.0, Mm(20.0), Mm(y), &bold);
    y -= 7.0;
    layer.use_text(&format!("{}%", score_value.score), 14.0, Mm(20.0), Mm(y), &font);
    y -= 12.0;

    layer.use_text("Summary", 14.0, Mm(20.0), Mm(y), &bold);
    y -= 7.0;
    let summary = brief["summary"].as_str().unwrap_or("");
    for line in wrap_text(summary, 95) {
        layer.use_text(&line, 11.0, Mm(20.0), Mm(y), &font);
        y -= 5.5;
    }
    y -= 8.0;

    layer.use_text("Details", 14.0, Mm(20.0), Mm(y), &bold);
    y -= 7.0;
    let details = format!(
        "Documents: {}   |   Word Count: {}   |   Key Terms: {}",
        brief["document_count"].as_u64().unwrap_or(0),
        brief["word_count"].as_u64().unwrap_or(0),
        brief["keyterm_count"].as_u64().unwrap_or(0),
    );
    layer.use_text(&details, 11.0, Mm(20.0), Mm(y), &font);
    y -= 6.0;
    let trained = brief["generated_at"].as_str().unwrap_or("");
    layer.use_text(&format!("Trained: {}", trained), 11.0, Mm(20.0), Mm(y), &font);

    let _ = score; // reserved for a future breakdown section

    let file = File::create(&output_path).map_err(|e| e.to_string())?;
    doc.save(&mut BufWriter::new(file)).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn set_document_personal(state: State<AppState>, document_id: String, is_personal: bool) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    repositories::document::DocumentRepository::set_is_personal(&conn, &document_id, is_personal)
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct PersonalProfile {
    summary: String,
    document_count: usize,
    generated_at: String,
}

/// Learns from documents the user explicitly marked Personal (CV,
/// resume, etc.) only — never from interviewer questions or
/// AI-generated answers, which don't represent the user's own voice.
#[tauri::command]
async fn learn_personal_profile(state: State<'_, AppState>) -> Result<PersonalProfile, String> {
    let (documents, sample_content) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let documents = repositories::document::DocumentRepository::list_personal(&conn)
            .map_err(|e| e.to_string())?;

        if documents.is_empty() {
            return Err("No documents marked as Personal yet. Mark your CV or resume as Personal in a project's document list first.".to_string());
        }

        let mut sample_content = String::new();
        for doc in &documents {
            let chunks = repositories::chunk::ChunkRepository::list_by_document(&conn, &doc.id)
                .unwrap_or_default();
            for chunk in chunks.iter().take(15) {
                sample_content.push_str(&chunk.content);
                sample_content.push_str("\n\n");
            }
        }

        (documents, sample_content)
    };

    let prompt = format!(
        "The following is content from someone's personal documents (CV, resume, etc.). Extract, in plain factual bullet points, only what is explicitly stated: their key skills, achievements, past projects, certifications, and any leadership examples. Do not invent anything not present in the text. If something isn't mentioned, don't include it.\n\nContent:\n{}",
        sample_content
    );

    let broker_identity: Option<license::broker::BrokerIdentity> = {
        use crate::license::status::read_token;
        use crate::license::verify::{check_token, TokenCheckResult};
        use crate::license::broker::BrokerIdentity;

        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let top_provider = repositories::settings::SettingsRepository::get(&conn, "ai.llm_provider_priority")
            .ok()
            .flatten()
            .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok())
            .and_then(|list| list.into_iter().next())
            .unwrap_or_else(|| "groq".to_string());

        read_token(&conn).and_then(|t| match check_token(&t) {
            TokenCheckResult::Valid(claims) if claims.token_type == "trial" => {
                claims.trial_session_id.map(BrokerIdentity::Trial)
            }
            TokenCheckResult::Valid(claims) if top_provider == "groq" => {
                let has_groq_key = repositories::api_keys::ApiKeyRepository::get(&conn, "groq")
                    .ok()
                    .flatten()
                    .is_some();
                if has_groq_key { None } else { claims.license_id.map(BrokerIdentity::License) }
            }
            _ => None,
        })
    };

    let summary = if let Some(identity) = broker_identity {
        license::broker::ask_groq_stream(&identity, &prompt, |_| {}).await?
    } else {
        let (provider, key) = {
            let conn = state.db.lock().map_err(|e| e.to_string())?;
            let provider_str = repositories::settings::SettingsRepository::get(&conn, "ai.llm_provider_priority")
                .ok()
                .flatten()
                .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok())
                .and_then(|list| list.into_iter().next())
                .unwrap_or_else(|| "groq".to_string());
            let provider = llm_engine::LlmProvider::from_str(&provider_str)
                .ok_or_else(|| format!("Unknown provider: {}", provider_str))?;
            let key = repositories::api_keys::ApiKeyRepository::get(&conn, provider.as_str())
                .map_err(|e| e.to_string())?
                .ok_or("No API key configured. Add one in AI Settings.")?;
            (provider, key)
        };
        llm_engine::ask(provider, &key, &prompt).await?
    };

    let generated_at = chrono::Utc::now().to_rfc3339();

    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let profile = serde_json::json!({
            "summary": summary,
            "document_count": documents.len(),
            "generated_at": generated_at,
        });
        let _ = repositories::settings::SettingsRepository::set(
            &conn,
            "personal_profile",
            &profile.to_string(),
            &generated_at,
        );
    }

    Ok(PersonalProfile {
        summary,
        document_count: documents.len(),
        generated_at,
    })
}

#[tauri::command]
fn get_project_brief(state: State<AppState>, project_id: String) -> Result<Option<serde_json::Value>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let raw = repositories::settings::SettingsRepository::get(&conn, &format!("project_brief.{}", project_id))
        .map_err(|e| e.to_string())?;
    Ok(raw.and_then(|json| serde_json::from_str(&json).ok()))
}

#[derive(serde::Serialize)]
struct NewDocumentsCheck {
    new_document_count: usize,
}

#[tauri::command]
fn check_new_documents(state: State<AppState>, project_id: String) -> Result<NewDocumentsCheck, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let current_ids: std::collections::HashSet<String> =
        repositories::document::DocumentRepository::list_by_project(&conn, &project_id)
            .map_err(|e| e.to_string())?
            .into_iter()
            .filter(|d| d.status == "ready")
            .map(|d| d.id)
            .collect();

    let trained_ids: std::collections::HashSet<String> = repositories::settings::SettingsRepository::get(
        &conn,
        &format!("project_brief.{}", project_id),
    )
    .ok()
    .flatten()
    .and_then(|json| serde_json::from_str::<serde_json::Value>(&json).ok())
    .and_then(|v| v["document_ids"].as_array().cloned())
    .map(|arr| arr.into_iter().filter_map(|v| v.as_str().map(String::from)).collect())
    .unwrap_or_default();

    let new_count = current_ids.difference(&trained_ids).count();
    Ok(NewDocumentsCheck { new_document_count: new_count })
}

/// Lighter than a full train — only reads documents added since the
/// last training run, and asks the LLM to fold new material into the
/// existing summary rather than re-analyzing everything from scratch.
#[tauri::command]
async fn optimize_knowledge(app: tauri::AppHandle, state: State<'_, AppState>, project_id: String) -> Result<TrainingReport, String> {
    let (previous_summary, previous_doc_ids, project_name): (String, Vec<String>, String) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;

        let existing = repositories::settings::SettingsRepository::get(&conn, &format!("project_brief.{}", project_id))
            .ok()
            .flatten()
            .and_then(|json| serde_json::from_str::<serde_json::Value>(&json).ok())
            .ok_or("This project hasn't been trained yet — use Train CoPilot Project first.")?;

        let summary = existing["summary"].as_str().unwrap_or_default().to_string();
        let doc_ids: Vec<String> = existing["document_ids"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        let name = repositories::project::ProjectRepository::list(&conn)
            .ok()
            .and_then(|projects| projects.into_iter().find(|p| p.id == project_id))
            .map(|p| p.name)
            .unwrap_or_else(|| "this project".to_string());

        (summary, doc_ids, name)
    };

    let (new_content, all_doc_ids, word_count, document_count, keyterms): (String, Vec<String>, usize, usize, Vec<String>) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;

        let documents: Vec<_> = repositories::document::DocumentRepository::list_by_project(&conn, &project_id)
            .map_err(|e| e.to_string())?
            .into_iter()
            .filter(|d| d.status == "ready")
            .collect();
        let all_doc_ids: Vec<String> = documents.iter().map(|d| d.id.clone()).collect();
        let new_doc_ids: std::collections::HashSet<&String> = all_doc_ids
            .iter()
            .filter(|id| !previous_doc_ids.contains(id))
            .collect();

        let chunks = repositories::chunk::ChunkRepository::list_by_project(&conn, &project_id)
            .map_err(|e| e.to_string())?;

        let new_content: String = chunks
            .iter()
            .filter(|c| new_doc_ids.contains(&c.document_id))
            .take(8)
            .map(|c| c.content.clone())
            .collect::<Vec<_>>()
            .join("\n\n");

        let word_count: usize = chunks.iter().map(|c| c.content.split_whitespace().count()).sum();
        let keyterms = rag_engine::keyterms::extract_keyterms(&conn, &project_id).unwrap_or_default();

        (new_content, all_doc_ids, word_count, documents.len(), keyterms)
    };

    if new_content.trim().is_empty() {
        return Err("No new documents found since the last training run.".to_string());
    }

    let prompt = format!(
        "Here is the existing summary of a project called \"{}\":\n{}\n\nHere is new content that was just added:\n{}\n\nWrite an updated 3-4 sentence summary that incorporates the new material, and list up to 5 key topics, technologies, or people mentioned across everything, old and new.",
        project_name, previous_summary, new_content
    );

    let broker_identity: Option<license::broker::BrokerIdentity> = {
        use crate::license::status::read_token;
        use crate::license::verify::{check_token, TokenCheckResult};
        use crate::license::broker::BrokerIdentity;

        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let top_provider = repositories::settings::SettingsRepository::get(&conn, "ai.llm_provider_priority")
            .ok()
            .flatten()
            .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok())
            .and_then(|list| list.into_iter().next())
            .unwrap_or_else(|| "groq".to_string());

        read_token(&conn).and_then(|t| match check_token(&t) {
            TokenCheckResult::Valid(claims) if claims.token_type == "trial" => {
                claims.trial_session_id.map(BrokerIdentity::Trial)
            }
            TokenCheckResult::Valid(claims) if top_provider == "groq" => {
                let has_groq_key = repositories::api_keys::ApiKeyRepository::get(&conn, "groq")
                    .ok()
                    .flatten()
                    .is_some();
                if has_groq_key {
                    None
                } else {
                    claims.license_id.map(BrokerIdentity::License)
                }
            }
            _ => None,
        })
    };

    let summary = if let Some(identity) = broker_identity {
        license::broker::ask_groq_stream(&identity, &prompt, |_| {}).await?
    } else {
        let (provider, key) = {
            let conn = state.db.lock().map_err(|e| e.to_string())?;
            let provider_str = repositories::settings::SettingsRepository::get(&conn, "ai.llm_provider_priority")
                .ok()
                .flatten()
                .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok())
                .and_then(|list| list.into_iter().next())
                .unwrap_or_else(|| "groq".to_string());
            let provider = llm_engine::LlmProvider::from_str(&provider_str)
                .ok_or_else(|| format!("Unknown provider: {}", provider_str))?;
            let key = repositories::api_keys::ApiKeyRepository::get(&conn, provider.as_str())
                .map_err(|e| e.to_string())?
                .ok_or("No API key configured. Add one in AI Settings.")?;
            (provider, key)
        };
        llm_engine::ask(provider, &key, &prompt).await?
    };

    let generated_at = chrono::Utc::now().to_rfc3339();

    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let profile = serde_json::json!({
            "summary": summary,
            "word_count": word_count,
            "document_count": document_count,
            "keyterm_count": keyterms.len(),
            "generated_at": generated_at,
            "document_ids": all_doc_ids,
        });
        let _ = repositories::settings::SettingsRepository::set(
            &conn,
            &format!("project_brief.{}", project_id),
            &profile.to_string(),
            &generated_at,
        );
    }

    let _ = app.emit("training_complete", &project_id);

    Ok(TrainingReport {
        project_name,
        document_count,
        word_count,
        keyterm_count: keyterms.len(),
        summary,
        generated_at,
    })
}

#[tauri::command]
async fn train_project(app: tauri::AppHandle, state: State<'_, AppState>, project_id: String) -> Result<TrainingReport, String> {
    let (word_count, document_count, keyterms, sample_content, project_name) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;

        let documents: Vec<_> = repositories::document::DocumentRepository::list_by_project(&conn, &project_id)
            .map_err(|e| e.to_string())?
            .into_iter()
            .filter(|d| d.status == "ready")
            .collect();
        let chunks = repositories::chunk::ChunkRepository::list_by_project(&conn, &project_id)
            .map_err(|e| e.to_string())?;
        let keyterms = rag_engine::keyterms::extract_keyterms(&conn, &project_id).unwrap_or_default();

        let word_count: usize = chunks.iter().map(|c| c.content.split_whitespace().count()).sum();
        let document_count = documents.len();

        // A bounded sample, not the whole project — keeps the one LLM
        // call's cost predictable regardless of how large the project is.
        let sample_content: String = chunks
            .iter()
            .take(8)
            .map(|c| c.content.clone())
            .collect::<Vec<_>>()
            .join("\n\n");

        let project_name = repositories::project::ProjectRepository::list(&conn)
            .ok()
            .and_then(|projects| projects.into_iter().find(|p| p.id == project_id))
            .map(|p| p.name)
            .unwrap_or_else(|| "this project".to_string());

        (word_count, document_count, keyterms, sample_content, project_name)
    };

    let prompt = format!(
        "You are analyzing documents for a project called \"{}\". Based on the content below, write a short 3-4 sentence summary of what this project is about, and list up to 5 key topics, technologies, or people mentioned. Keep it factual, based only on the content given.\n\nContent:\n{}",
        project_name, sample_content
    );

    // Reuse the exact same broker-vs-BYOK resolution ask_pet already uses
    // — trial, OR Licensed-with-no-Groq-key falling back to credits, OR
    // BYOK — so training respects the same rules as live answers.
    let broker_identity: Option<license::broker::BrokerIdentity> = {
        use crate::license::status::read_token;
        use crate::license::verify::{check_token, TokenCheckResult};
        use crate::license::broker::BrokerIdentity;

        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let top_provider = repositories::settings::SettingsRepository::get(&conn, "ai.llm_provider_priority")
            .ok()
            .flatten()
            .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok())
            .and_then(|list| list.into_iter().next())
            .unwrap_or_else(|| "groq".to_string());

        read_token(&conn).and_then(|t| match check_token(&t) {
            TokenCheckResult::Valid(claims) if claims.token_type == "trial" => {
                claims.trial_session_id.map(BrokerIdentity::Trial)
            }
            TokenCheckResult::Valid(claims) if top_provider == "groq" => {
                let has_groq_key = repositories::api_keys::ApiKeyRepository::get(&conn, "groq")
                    .ok()
                    .flatten()
                    .is_some();
                if has_groq_key {
                    None
                } else {
                    claims.license_id.map(BrokerIdentity::License)
                }
            }
            _ => None,
        })
    };

    let summary = if let Some(identity) = broker_identity {
        license::broker::ask_groq_stream(&identity, &prompt, |_| {}).await?
    } else {
        let (provider, key) = {
            let conn = state.db.lock().map_err(|e| e.to_string())?;
            let provider_str = repositories::settings::SettingsRepository::get(&conn, "ai.llm_provider_priority")
                .ok()
                .flatten()
                .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok())
                .and_then(|list| list.into_iter().next())
                .unwrap_or_else(|| "groq".to_string());
            let provider = llm_engine::LlmProvider::from_str(&provider_str)
                .ok_or_else(|| format!("Unknown provider: {}", provider_str))?;
            let key = repositories::api_keys::ApiKeyRepository::get(&conn, provider.as_str())
                .map_err(|e| e.to_string())?
                .ok_or("No API key configured for training. Add one in AI Settings.")?;
            (provider, key)
        };
        llm_engine::ask(provider, &key, &prompt).await?
    };

    let generated_at = chrono::Utc::now().to_rfc3339();

    let document_ids: Vec<String> = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        repositories::document::DocumentRepository::list_by_project(&conn, &project_id)
            .map_err(|e| e.to_string())?
            .into_iter()
            .map(|d| d.id)
            .collect()
    };

    // Save the real profile — this is what future live answers will draw
    // on, not just today's report display.
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let profile = serde_json::json!({
            "summary": summary,
            "word_count": word_count,
            "document_count": document_count,
            "keyterm_count": keyterms.len(),
            "generated_at": generated_at,
            "document_ids": document_ids,
        });
        let _ = repositories::settings::SettingsRepository::set(
            &conn,
            &format!("project_brief.{}", project_id),
            &profile.to_string(),
            &generated_at,
        );
    }

    let _ = app.emit("training_complete", &project_id);

    Ok(TrainingReport {
        project_name,
        document_count,
        word_count,
        keyterm_count: keyterms.len(),
        summary,
        generated_at,
    })
}

#[tauri::command]
fn get_project_knowledge_stats(state: State<AppState>, project_id: String) -> Result<ProjectKnowledgeStats, String> {
    const MIN_DOCUMENTS: usize = 5;
    const MIN_WORDS: usize = 5000;

    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let documents = repositories::document::DocumentRepository::list_by_project(&conn, &project_id)
        .map_err(|e| e.to_string())?;
    let chunks = repositories::chunk::ChunkRepository::list_by_project(&conn, &project_id)
        .map_err(|e| e.to_string())?;

    let word_count: usize = chunks.iter().map(|c| c.content.split_whitespace().count()).sum();
    let document_count = documents.len();

    Ok(ProjectKnowledgeStats {
        document_count,
        word_count,
        ready_to_train: document_count >= MIN_DOCUMENTS || word_count >= MIN_WORDS,
    })
}

#[tauri::command]
fn get_license_details(state: State<'_, AppState>) -> Result<LicenseDetails, String> {
    use license::status::{read_last_verified, read_token};
    use license::verify::{check_token, TokenCheckResult};

    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let token = match read_token(&conn) {
        Some(t) => t,
        None => {
            return Ok(LicenseDetails {
                mode: "ActivationRequired".to_string(),
                license_id: None,
                plan: None,
                email: None,
                max_devices: None,
                activation_count: None,
                masked_key: None,
                last_verified_at: None,
                expires_at: None,
                deepgram_source: None,
                groq_source: None,
            })
        }
    };

    let claims = match check_token(&token) {
        TokenCheckResult::Valid(c) | TokenCheckResult::Expired(c) => c,
        TokenCheckResult::Invalid => {
            return Ok(LicenseDetails {
                mode: "ActivationRequired".to_string(),
                license_id: None,
                plan: None,
                email: None,
                max_devices: None,
                activation_count: None,
                masked_key: None,
                last_verified_at: None,
                expires_at: None,
                deepgram_source: None,
                groq_source: None,
            })
        }
    };

    let raw_key = crate::repositories::settings::SettingsRepository::get(&conn, "license.key")
        .ok()
        .flatten();

    let masked_key = raw_key.map(|k| {
        if k.len() > 8 {
            format!("{}****{}", &k[..4], &k[k.len() - 4..])
        } else {
            k
        }
    });

    let last_verified_at = read_last_verified(&conn);
    let is_trial = claims.token_type == "trial";

    Ok(LicenseDetails {
        mode: if is_trial { "Trial".to_string() } else { "Licensed".to_string() },
        license_id: claims.license_id,
        plan: claims.plan,
        email: claims.email,
        max_devices: claims.max_devices,
        activation_count: claims.activation_count,
        masked_key,
        last_verified_at: Some(last_verified_at),
        expires_at: Some(claims.exp),
        deepgram_source: Some(provider_source(&conn, "deepgram", is_trial)),
        groq_source: Some(provider_source(&conn, "groq", is_trial)),
    })
}

#[tauri::command]
async fn verify_provider_key(provider: String, key: String) -> Result<(), String> {
    if provider == "deepgram" {
        return stt_engine::deepgram::verify_key(&key).await;
    }
    let llm_provider = llm_engine::LlmProvider::from_str(&provider)
        .ok_or_else(|| format!("Unknown provider: {}", provider))?;
    llm_engine::verify_key(llm_provider, &key).await
}

#[tauri::command]
async fn create_credit_checkout(state: State<'_, AppState>, quantity: u32) -> Result<String, String> {
    use license::status::read_token;
    use license::verify::{check_token, TokenCheckResult};

    let license_id = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        read_token(&conn)
            .and_then(|t| match check_token(&t) {
                TokenCheckResult::Valid(claims) => claims.license_id,
                _ => None,
            })
            .ok_or("No active license found")?
    };

    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:3000/api/stripe/checkout-credits")
        .json(&serde_json::json!({ "licenseId": license_id, "quantity": quantity }))
        .send()
        .await
        .map_err(|e| format!("Checkout request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(text);
    }

    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    data["url"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("No checkout URL returned".to_string())
}

#[tauri::command]
async fn start_trial(state: State<'_, AppState>, email: String) -> Result<license::mode::AppMode, String> {
    use license::status::*;
    use license::verify::{check_token, TokenCheckResult};

    let device_id = license::fingerprint::get_device_fingerprint()?;
    let token = license::client::start_trial(&email, &device_id).await?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    store_token(&conn, &token)?;

    match check_token(&token) {
        TokenCheckResult::Valid(claims) => Ok(mode_from_claims(&claims)),
        _ => Err("Received an invalid token from the server".to_string()),
    }
}

enum AuthMode {
    Byok(String),
    Trial(String),  // trial_session_id
    Credit(String), // license_id — falls back to purchased credits when no BYOK key is set
}

async fn determine_auth_mode(state: &State<'_, AppState>) -> Result<AuthMode, String> {
    use license::status::read_token;
    use license::verify::{check_token, TokenCheckResult};

    let token = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        read_token(&conn)
    };

    let mut license_id_for_credit_fallback: Option<String> = None;

    if let Some(t) = token {
        if let TokenCheckResult::Valid(claims) = check_token(&t) {
            if claims.token_type == "trial" {
                let trial_id = claims
                    .trial_session_id
                    .ok_or("Trial token missing trialSessionId")?;
                return Ok(AuthMode::Trial(trial_id));
            }
            license_id_for_credit_fallback = claims.license_id;
        }
    }

    // Licensed — prefer BYOK (costs us nothing), fall back to purchased
    // credits if no BYOK key is configured yet.
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let byok_key = crate::repositories::api_keys::ApiKeyRepository::get(&conn, "deepgram")
        .map_err(|e| e.to_string())?;

    match byok_key {
        Some(key) => Ok(AuthMode::Byok(key)),
        None => {
            let license_id = license_id_for_credit_fallback
                .ok_or("No Deepgram API key configured, and no license found for credit fallback.")?;
            Ok(AuthMode::Credit(license_id))
        }
    }
}

#[tauri::command]
async fn start_meeting_session(app: tauri::AppHandle, state: State<'_, AppState>, project_id: Option<String>) -> Result<(), String> {
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let session_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        repositories::session::SessionRepository::create(
            &conn,
            &repositories::session::Session {
                id: session_id.clone(),
                project_id: project_id.clone(),
                title: None,
                meeting_source: "Live Meeting".to_string(),
                status: "active".to_string(),
                started_at: now,
                ended_at: None,
            },
        )
        .map_err(|e| e.to_string())?;

        let mut current = state.current_session_id.lock().map_err(|e| e.to_string())?;
        *current = Some(session_id);
    }

    {
        let mut session = state.audio_session.lock().map_err(|e| e.to_string())?;
        if let Some(stale) = session.take() {
            println!("Cleaning up stale session before starting a new one.");
            (stale.stop_capture)();
            for task in stale.tasks {
                task.abort();
            }
        }
    }

    let auth = determine_auth_mode(&state).await?;

    let keyterms = if let Some(pid) = &project_id {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        rag_engine::keyterms::extract_keyterms(&conn, pid).unwrap_or_default()
    } else {
        Vec::new()
    };

    tauri::async_runtime::spawn(run_session_with_reconnect(app, auth, keyterms));

    Ok(())
}

/// Runs one capture+transcription session, reconnecting on: a device
/// change (headphones unplugged, etc.), or — for trial users only — a
/// self-enforced ~18-minute renewal, since Deepgram's temp tokens only
/// need to be valid at connection time, so the cap has to be enforced by
/// us choosing to reconnect, not by the token itself expiring mid-call.
async fn run_session_with_reconnect(app: tauri::AppHandle, auth: AuthMode, keyterms: Vec<String>) {
    const MAX_RECONNECT_ATTEMPTS: u32 = 3;
    const TRIAL_RENEWAL_SECS: u64 = 18 * 60;
    let mut attempt = 0;

    loop {
        let (token, use_bearer) = match &auth {
            AuthMode::Byok(key) => (key.clone(), false),
            AuthMode::Trial(trial_id) => {
                let identity = license::broker::BrokerIdentity::Trial(trial_id.clone());
                match license::broker::request_deepgram_token(&identity).await {
                    Ok(resp) => (resp.access_token, true),
                    Err(e) => {
                        println!("Trial broker token request failed: {}", e);
                        let _ = app.emit("trial_ended", e);
                        return;
                    }
                }
            }
            AuthMode::Credit(license_id) => {
                let identity = license::broker::BrokerIdentity::License(license_id.clone());
                match license::broker::request_deepgram_token(&identity).await {
                    Ok(resp) => (resp.access_token, true),
                    Err(e) => {
                        println!("Credit broker token request failed: {}", e);
                        let _ = app.emit("credits_exhausted", e);
                        return;
                    }
                }
            }
        };

        let capture = match audio_engine::start_capture() {
            Ok(c) => c,
            Err(e) => {
                println!("Failed to start audio capture: {}", e);
                let _ = app.emit("audio_disconnected", ());
                return;
            }
        };
        let stop_capture = capture.stopper();
        let device_changed_rx = capture.device_changed;
        let audio_receiver = capture.receiver;

        let (mut rx, tasks) = match stt_engine::deepgram::start_transcription(
            audio_receiver,
            token,
            use_bearer,
            keyterms.clone(),
        )
        .await
        {
            Ok(r) => r,
            Err(e) => {
                println!("Failed to start Deepgram: {}", e);
                let _ = app.emit("audio_disconnected", ());
                return;
            }
        };

        {
            let state = app.state::<AppState>();
            let mut session = state.audio_session.lock().unwrap();
            *session = Some(AudioSession {
                stop_capture: Box::new(stop_capture),
                tasks,
            });
        }

        if attempt > 0 {
            let _ = app.emit("audio_reconnected", ());
        }
        attempt = 0;

        let (dc_tx, mut dc_rx) = tokio::sync::oneshot::channel::<()>();
        std::thread::spawn(move || {
            if device_changed_rx.recv().is_ok() {
                let _ = dc_tx.send(());
            }
        });

        let is_trial = matches!(auth, AuthMode::Trial(_) | AuthMode::Credit(_));

        loop {
            tokio::select! {
                event = rx.recv() => {
                    match event {
                        Some(e) => {
                            if e.is_final {
                                println!("Final:\n{}", e.text);
                                let decision = question_engine::classify(&e.text);
                                if decision.classification == question_engine::QuestionClassification::RealQuestion {
                                    println!("🎯 Question detected (confidence {:.2}): {}", decision.confidence, e.text);
                                    let _ = app.emit("question_detected", &e.text);
                                }
                            } else {
                                println!("Partial:\n{}", e.text);
                            }
                        }
                        None => {
                            println!("Transcript stream ended.");
                            return;
                        }
                    }
                }
                _ = &mut dc_rx => {
                    println!("Audio device changed, reconnecting...");
                    break;
                }
                _ = tokio::time::sleep(std::time::Duration::from_secs(TRIAL_RENEWAL_SECS)), if is_trial => {
                    println!("Trial renewal interval reached, refreshing broker token...");
                    break;
                }
            }
        }

        {
            let state = app.state::<AppState>();
            let mut session = state.audio_session.lock().unwrap();
            if let Some(s) = session.take() {
                (s.stop_capture)();
                for task in s.tasks {
                    task.abort();
                }
            }
        }

        let _ = app.emit("audio_reconnecting", ());
        attempt += 1;

        if attempt > MAX_RECONNECT_ATTEMPTS {
            println!("Giving up after {} reconnect attempts.", MAX_RECONNECT_ATTEMPTS);
            let _ = app.emit("audio_disconnected", ());
            return;
        }

        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
}

#[tauri::command]
fn stop_meeting_session(state: State<AppState>) -> Result<(), String> {
    let mut session = state.audio_session.lock().map_err(|e| e.to_string())?;
    if let Some(s) = session.take() {
        (s.stop_capture)();
        for task in s.tasks {
            task.abort();
        }
        println!("Session stopped.");
    }

    let mut current = state.current_session_id.lock().map_err(|e| e.to_string())?;
    if let Some(session_id) = current.take() {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        let _ = repositories::session::SessionRepository::end_session(&conn, &session_id, &now);
    }

    Ok(())
}

#[tauri::command]
async fn test_deepgram_transcription(state: State<'_, AppState>, seconds: u64) -> Result<Vec<String>, String> {
    let api_key = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        crate::repositories::api_keys::ApiKeyRepository::get(&conn, "deepgram")
            .map_err(|e| e.to_string())?
            .ok_or("No Deepgram API key configured. Add one in AI Settings.")?
    };

    let capture = audio_engine::start_capture()?;
    let stop = capture.stopper();

    let (mut rx, _tasks) = stt_engine::deepgram::start_transcription(capture.receiver, api_key, false, Vec::new()).await?;

    let mut finals = Vec::new();
    let deadline = tokio::time::Instant::now() + tokio::time::Duration::from_secs(seconds);

    loop {
        tokio::select! {
            _ = tokio::time::sleep_until(deadline) => break,
            event = rx.recv() => {
                match event {
                    Some(e) => {
                        if e.is_final {
                            println!("Final:\n{}", e.text);

                            let decision = question_engine::classify(&e.text);
                            if decision.classification == question_engine::QuestionClassification::RealQuestion {
                                println!("🎯 Question detected (confidence {:.2}): {}", decision.confidence, e.text);
                            }

                            finals.push(e.text);
                        } else {
                            println!("Partial:\n{}", e.text);
                        }
                    }
                    None => break,
                }
            }
        }
    }

    stop();
    Ok(finals)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            let conn = db::init_db(&app_data_dir)
                .expect("Failed to initialize database");

            app.manage(AppState {
                db: Mutex::new(conn),
                audio_session: Mutex::new(None),
                current_session_id: Mutex::new(None),
            });

            // Warm the embedding model at startup so the cost lands here,
            // not on the user's first live question during a real meeting.
            std::thread::spawn(|| {
                let _ = rag_engine::embed::embed_texts(&["warmup".to_string()]);
                println!("Embedding model warmed up.");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            test_audio_loopback,
            get_license_status,
            activate_license,
            start_trial,
            get_license_details,
            create_credit_checkout,
            get_qa_history,
            get_project_knowledge_stats,
            train_project,
            get_project_brief,
            get_project_brief,
            check_new_documents,
            optimize_knowledge,
            set_document_personal,
            learn_personal_profile,
            get_personalization_score,
            export_project_brief_pdf,
            verify_provider_key,
            test_broker_token,
            test_deepgram_transcription,
            start_meeting_session,
            stop_meeting_session,
            create_project,
            list_projects,
            update_project,
            delete_project,
            set_active_project,
            get_setting,
            set_setting,
            get_all_settings,
            delete_setting,
            optimize_database,
            set_api_key,
            get_api_key,
            delete_api_key,
            upload_document,
            list_documents,
            delete_document,
            get_project_storage,
            get_document_job,
            search_documents,
            build_answer_prompt,
            ask_pet
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}