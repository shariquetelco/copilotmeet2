use fastembed::{TextEmbedding, InitOptions, EmbeddingModel};
use std::sync::OnceLock;

static MODEL: OnceLock<TextEmbedding> = OnceLock::new();

fn get_model() -> Result<&'static TextEmbedding, String> {
    if let Some(model) = MODEL.get() {
        return Ok(model);
    }

    let model = TextEmbedding::try_new(
        InitOptions::new(EmbeddingModel::AllMiniLML6V2).with_show_download_progress(true),
    )
    .map_err(|e| format!("Failed to load embedding model: {}", e))?;

    Ok(MODEL.get_or_init(|| model))
}

/// Generates a 384-dimension embedding vector for each input text chunk.
pub fn embed_texts(texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
    let model = get_model()?;
    model
        .embed(texts.to_vec(), None)
        .map_err(|e| format!("Embedding failed: {}", e))
}