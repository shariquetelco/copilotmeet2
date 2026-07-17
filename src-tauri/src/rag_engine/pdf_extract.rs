use pdfium_render::prelude::*;
use crate::rag_engine::ocr_extract;

fn bind_pdfium() -> Result<Pdfium, String> {
    let lib_path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .join("pdfium-lib/lib");

    Ok(Pdfium::new(
        Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(&lib_path))
            .map_err(|e| format!("Failed to load PDFium library: {}", e))?,
    ))
}

/// Extracts all selectable text from a PDF. Returns an empty string
/// (not an error) for scanned/image-only PDFs with no text layer —
/// callers should fall back to extract_text_via_ocr in that case.
pub fn extract_text(file_path: &str) -> Result<String, String> {
    let pdfium = bind_pdfium()?;

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

/// Rasterizes every page of a scanned PDF into an image and runs OCR on each.
/// Used when extract_text() returns no selectable text.
pub fn extract_text_via_ocr(file_path: &str) -> Result<String, String> {
    let pdfium = bind_pdfium()?;

    let document = pdfium
        .load_pdf_from_file(file_path, None)
        .map_err(|e| format!("Failed to open PDF: {}", e))?;

    let render_config = PdfRenderConfig::new()
        .set_target_width(2000)
        .set_maximum_height(2000);

    let mut full_text = String::new();
    for page in document.pages().iter() {
        let image = page
            .render_with_config(&render_config)
            .map_err(|e| format!("Failed to render page: {}", e))?
            .as_image();

        let page_text = ocr_extract::extract_text_from_dynamic_image(&image)?;
        full_text.push_str(&page_text);
        full_text.push('\n');
    }

    Ok(full_text)
}