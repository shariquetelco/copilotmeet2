mod pdf_extract;
mod office_extract;

use crate::repositories::document::{Document, DocumentRepository};
use crate::repositories::document_job::DocumentJobRepository;
use rusqlite::Connection;
use chrono::Utc;
use std::fs;

/// Runs the processing pipeline for a document, synchronously for now.
/// Currently only TXT/MD extraction is implemented — other file types
/// will be added incrementally in follow-up sessions, and will simply
/// stay at "pending" until their extraction step exists.
pub fn process_document(conn: &Connection, doc: &Document) -> Result<(), String> {
    let advance = |stage: &str, error: Option<&str>| -> Result<(), String> {
        let now = Utc::now().to_rfc3339();
        DocumentJobRepository::update_stage(conn, &doc.id, stage, error, &now)
            .map_err(|e| e.to_string())
    };

    match doc.file_type.as_str() {
        "TXT" | "MD" => {
            advance("extracting", None)?;

            let _text = fs::read_to_string(&doc.file_path)
                .map_err(|e| e.to_string())?;

            // "OCR" stage is skipped entirely for plain text — nothing to OCR
            advance("cleaning", None)?;
            // Clean & Normalize implementation arrives in a follow-up step

            advance("chunking", None)?;
            // Chunking implementation arrives in a follow-up step

            advance("embedding", None)?;
            // Embedding implementation arrives in a follow-up step

            advance("indexing", None)?;
            // LanceDB storage implementation arrives in a follow-up step

            advance("completed", None)?;
            DocumentRepository::update_status(conn, &doc.id, "ready").map_err(|e| e.to_string())?;
        }
        "PDF" => {
            advance("extracting", None)?;

            let text = pdf_extract::extract_text(&doc.file_path)?;

            if text.trim().is_empty() {
                // No selectable text layer — this is a scanned PDF.
                // OCR fallback isn't implemented yet, so stay honestly at this stage.
                advance("ocr", None)?;
                return Ok(());
            }

            advance("cleaning", None)?;
            advance("chunking", None)?;
            advance("embedding", None)?;
            advance("indexing", None)?;
            advance("completed", None)?;
            DocumentRepository::update_status(conn, &doc.id, "ready").map_err(|e| e.to_string())?;
        }
        "DOCX" | "XLSX" | "PPTX" => {
            advance("extracting", None)?;

            let text = office_extract::extract_text(&doc.file_path, &doc.file_type)?;

            if text.trim().is_empty() {
                advance("failed", Some("No readable text found in this file"))?;
                return Ok(());
            }

            advance("cleaning", None)?;
            advance("chunking", None)?;
            advance("embedding", None)?;
            advance("indexing", None)?;
            advance("completed", None)?;
            DocumentRepository::update_status(conn, &doc.id, "ready").map_err(|e| e.to_string())?;
        }
        _ => {
            // PNG/JPEG (OCR) not yet implemented —
            // job stays at "pending" rather than silently failing or faking success.
        }
    }

    Ok(())
}