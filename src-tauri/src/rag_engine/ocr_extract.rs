use rusty_tesseract::{Args, Image};

/// Runs OCR on an image file (PNG/JPEG) and returns the extracted text.
pub fn extract_text_from_image(file_path: &str) -> Result<String, String> {
    let img = Image::from_path(file_path).map_err(|e| e.to_string())?;
    let args = Args::default();

    rusty_tesseract::image_to_string(&img, &args).map_err(|e| e.to_string())
}

/// Runs OCR directly on an in-memory rendered image (used for scanned PDF pages).
pub fn extract_text_from_dynamic_image(img: &image::DynamicImage) -> Result<String, String> {
    let tess_img = Image::from_dynamic_image(img).map_err(|e| e.to_string())?;
    let args = Args::default();

    rusty_tesseract::image_to_string(&tess_img, &args).map_err(|e| e.to_string())
}