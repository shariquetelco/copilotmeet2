use dotext::*;
use std::io::Read;

/// Extracts plain text from DOCX, XLSX, or PPTX files.
/// Returns raw UTF-8 text — no layout, tables, or formatting preserved,
/// only the underlying words/numbers, which is all RAG retrieval needs.
pub fn extract_text(file_path: &str, file_type: &str) -> Result<String, String> {
    let mut text = String::new();

    match file_type {
        "DOCX" => {
            let mut doc = Docx::open(file_path).map_err(|e| e.to_string())?;
            doc.read_to_string(&mut text).map_err(|e| e.to_string())?;
        }
        "XLSX" => {
            let mut doc = Xlsx::open(file_path).map_err(|e| e.to_string())?;
            doc.read_to_string(&mut text).map_err(|e| e.to_string())?;
        }
        "PPTX" => {
            let mut doc = Pptx::open(file_path).map_err(|e| e.to_string())?;
            doc.read_to_string(&mut text).map_err(|e| e.to_string())?;
        }
        _ => return Err(format!("Unsupported office file type: {}", file_type)),
    }

    Ok(text)
}