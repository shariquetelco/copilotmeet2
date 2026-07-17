use pdfium_render::prelude::*;

/// Extracts all selectable text from a PDF. Returns an empty string
/// (not an error) for scanned/image-only PDFs with no text layer —
/// that case is handled by the OCR fallback, added in a later step.
pub fn extract_text(file_path: &str) -> Result<String, String> {
    let lib_path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .join("pdfium-lib/lib");

    let pdfium = Pdfium::new(
        Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(&lib_path))
            .map_err(|e| format!("Failed to load PDFium library: {}", e))?,
    );

    let document = pdfium
        .load_pdf_from_file(file_path, None)
        .map_err(|e| format!("Failed to open PDF: {}", e))?;

    let mut full_text = String::new();
    for page in document.pages().iter() {
        let page_text = page
            .text()
            .map_err(|e| format!("Failed to extract page text: {}", e))?
            .all();
        full_text.push_str(&page_text);
        full_text.push('\n');
    }

    Ok(full_text)
}