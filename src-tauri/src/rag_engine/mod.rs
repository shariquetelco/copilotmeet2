mod pdf_extract;
mod office_extract;
mod ocr_extract;
mod normalize;

use crate::repositories::document::{Document, DocumentRepository};
use crate::repositories::document_job::DocumentJobRepository;
use rusqlite::Connection;
use chrono::Utc;
use std::fs;

pub fn process_document(conn: &Connection, doc: &Document) -> Result<(), String> {
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
    // Chunking implementation arrives next step

    advance("embedding", None)?;
    // Embedding implementation arrives in a follow-up step

    advance("indexing", None)?;
    // LanceDB storage implementation arrives in a follow-up step

    advance("completed", None)?;
    DocumentRepository::update_status(conn, &doc.id, "ready").map_err(|e| e.to_string())?;

    let _ = cleaned_text; // will be consumed by chunking, next step

    Ok(())
}