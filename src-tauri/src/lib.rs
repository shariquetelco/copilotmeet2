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
    plan: Option<String>,
    email: Option<String>,
    max_devices: Option<u32>,
    activation_count: Option<u32>,
    masked_key: Option<String>,
    last_verified_at: Option<i64>,
    expires_at: Option<usize>,
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
                plan: None,
                email: None,
                max_devices: None,
                activation_count: None,
                masked_key: None,
                last_verified_at: None,
                expires_at: None,
            })
        }
    };

    let claims = match check_token(&token) {
        TokenCheckResult::Valid(c) | TokenCheckResult::Expired(c) => c,
        TokenCheckResult::Invalid => {
            return Ok(LicenseDetails {
                mode: "ActivationRequired".to_string(),
                plan: None,
                email: None,
                max_devices: None,
                activation_count: None,
                masked_key: None,
                last_verified_at: None,
                expires_at: None,
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

    Ok(LicenseDetails {
        mode: if claims.token_type == "trial" { "Trial".to_string() } else { "Licensed".to_string() },
        plan: claims.plan,
        email: claims.email,
        max_devices: claims.max_devices,
        activation_count: claims.activation_count,
        masked_key,
        last_verified_at: Some(last_verified_at),
        expires_at: Some(claims.exp),
    })
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

#[tauri::command]
async fn start_meeting_session(app: tauri::AppHandle, state: State<'_, AppState>, project_id: Option<String>) -> Result<(), String> {
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

    let api_key = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        crate::repositories::api_keys::ApiKeyRepository::get(&conn, "deepgram")
            .map_err(|e| e.to_string())?
            .ok_or("No Deepgram API key configured. Add one in AI Settings.")?
    };

    let keyterms = if let Some(pid) = &project_id {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        rag_engine::keyterms::extract_keyterms(&conn, pid).unwrap_or_default()
    } else {
        Vec::new()
    };

    tauri::async_runtime::spawn(run_session_with_reconnect(app, api_key, keyterms));

    Ok(())
}

/// Runs one capture+transcription session. If the underlying audio device
/// changes mid-meeting (headphones unplugged, etc.), the current session
/// can't just keep going — Deepgram's audio format is locked in for the
/// life of its connection — so this cleanly restarts capture and Deepgram
/// against whatever the new default device is, up to a few attempts,
/// before giving up and telling the UI it's genuinely disconnected.
async fn run_session_with_reconnect(app: tauri::AppHandle, api_key: String, keyterms: Vec<String>) {
    const MAX_RECONNECT_ATTEMPTS: u32 = 3;
    let mut attempt = 0;

    loop {
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
            api_key.clone(),
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

    let (mut rx, _tasks) = stt_engine::deepgram::start_transcription(capture.receiver, api_key, Vec::new()).await?;

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