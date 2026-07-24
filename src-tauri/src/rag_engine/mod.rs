mod pdf_extract;
mod office_extract;
mod ocr_extract;
mod normalize;
mod chunk;
pub mod keyterms;
pub mod embed;
pub mod vector_store;
pub mod prompt_builder;

use crate::repositories::document::{Document, DocumentRepository};
use crate::repositories::document_job::DocumentJobRepository;
use crate::repositories::chunk::{Chunk, ChunkRepository};
use vector_store::VectorRecord;
use rusqlite::Connection;
use chrono::Utc;
use std::fs;
use uuid::Uuid;

pub fn process_document(conn: &Connection, doc: &Document, app_data_dir: &std::path::Path) -> Result<(), String> {
    let advance = |stage: &str, error: Option<&str>| -> Result<(), String> {
        let now = Utc::now().to_rfc3339();
        DocumentJobRepository::update_stage(conn, &doc.id, stage, error, &now)
            .map_err(|e| e.to_string())
    };

    let raw_text = match doc.file_type.as_str() {
        "TXT" | "MD" => {
            advance("extracting", None)?;
            fs::read_to_string(&doc.file_path).map_err(|e| e.to_string())?
        }
        "PDF" => {
            advance("extracting", None)?;
            let mut text = pdf_extract::extract_text(&doc.file_path)?;

            if text.trim().is_empty() {
                advance("ocr", None)?;
                text = pdf_extract::extract_text_via_ocr(&doc.file_path)?;
            }
            text
        }
        "DOCX" | "XLSX" | "PPTX" => {
            advance("extracting", None)?;
            office_extract::extract_text(&doc.file_path, &doc.file_type)?
        }
        "PNG" | "JPG" | "JPEG" => {
            advance("ocr", None)?;
            ocr_extract::extract_text_from_image(&doc.file_path)?
        }
        other => {
            return Err(format!("Unsupported file type: {}", other));
        }
    };

    if raw_text.trim().is_empty() {
        advance("failed", Some("No readable text found in this document"))?;
        return Ok(());
    }

    advance("cleaning", None)?;
    let cleaned_text = normalize::clean(&raw_text);

    advance("chunking", None)?;
    let text_chunks = chunk::chunk_text(
        &cleaned_text,
        chunk::DEFAULT_CHUNK_SIZE_WORDS,
        chunk::DEFAULT_OVERLAP_WORDS,
    );

    let now = Utc::now().to_rfc3339();
    let chunk_records: Vec<Chunk> = text_chunks
        .iter()
        .enumerate()
        .map(|(i, content)| Chunk {
            id: Uuid::new_v4().to_string(),
            document_id: doc.id.clone(),
            project_id: doc.project_id.clone(),
            chunk_index: i as i32,
            content: content.clone(),
            created_at: now.clone(),
        })
        .collect();

    ChunkRepository::create_many(conn, &chunk_records).map_err(|e| e.to_string())?;

    advance("embedding", None)?;
    let chunk_texts: Vec<String> = chunk_records.iter().map(|c| c.content.clone()).collect();
    let embeddings = embed::embed_texts(&chunk_texts)?;

    advance("indexing", None)?;
    let db_path = app_data_dir.join("lancedb");
    let db_path_str = db_path.to_string_lossy().to_string();

    let vector_records: Vec<VectorRecord> = chunk_records
        .iter()
        .zip(embeddings.iter())
        .map(|(chunk, embedding)| VectorRecord {
            id: chunk.id.clone(),
            document_id: chunk.document_id.clone(),
            project_id: chunk.project_id.clone(),
            content: chunk.content.clone(),
            embedding: embedding.clone(),
        })
        .collect();

    vector_store::store_embeddings(&db_path_str, &vector_records)?;

    advance("completed", None)?;
    DocumentRepository::update_status(conn, &doc.id, "ready").map_err(|e| e.to_string())?;

    Ok(())
}