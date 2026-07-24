mod db;
mod repositories;
mod commands;
mod rag_engine;
mod llm_engine;
mod question_engine;
mod audio_engine;
mod stt_engine;

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

    let capture = audio_engine::start_capture()?;
    let stop_capture = capture.stopper();

    let (mut rx, tasks) = stt_engine::deepgram::start_transcription(capture, api_key, keyterms).await?;

    {
        let mut session = state.audio_session.lock().map_err(|e| e.to_string())?;
        *session = Some(AudioSession {
            stop_capture: Box::new(stop_capture),
            tasks,
        });
    }

    tauri::async_runtime::spawn(async move {
        while let Some(e) = rx.recv().await {
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
        println!("Transcript stream ended.");
    });

    Ok(())
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

    let (mut rx, _tasks) = stt_engine::deepgram::start_transcription(capture, api_key, Vec::new()).await?;

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