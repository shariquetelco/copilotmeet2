use rusty_tesseract::{Args, Image};

/// Runs OCR on an image file (PNG/JPEG) and returns the extracted text.
pub fn extract_text_from_image(file_path: &str) -> Result<String, String> {
    let img = Image::from_path(file_path).map_err(|e| e.to_string())?;
    let args = Args::default();

    rusty_tesseract::image_to_string(&img, &args).map_err(|e| e.to_string())
}