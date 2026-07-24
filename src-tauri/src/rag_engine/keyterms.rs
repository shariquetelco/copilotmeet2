use crate::repositories::chunk::ChunkRepository;
use rusqlite::Connection;
use std::collections::HashMap;

/// Pulls likely domain-specific terms (acronyms, technical short-form
/// words like YOLO, RAG, WASAPI) out of a project's documents, so
/// Deepgram can be told to specifically listen for them.
pub fn extract_keyterms(conn: &Connection, project_id: &str) -> Result<Vec<String>, String> {
    let chunks = ChunkRepository::list_by_project(conn, project_id).map_err(|e| e.to_string())?;

    let mut counts: HashMap<String, u32> = HashMap::new();

    for chunk in &chunks {
        for word in chunk.content.split_whitespace() {
            let cleaned: String = word.chars().filter(|c| c.is_ascii_alphanumeric()).collect();

            if cleaned.len() < 2 || cleaned.len() > 10 {
                continue;
            }

            let uppercase_count = cleaned.chars().filter(|c| c.is_ascii_uppercase()).count();
            let is_acronym_like = uppercase_count as f32 / cleaned.len() as f32 >= 0.6;

            if is_acronym_like {
                *counts.entry(cleaned).or_insert(0) += 1;
            }
        }
    }

    let mut terms: Vec<(String, u32)> = counts.into_iter().collect();
    terms.sort_by(|a, b| b.1.cmp(&a.1));
    terms.truncate(40);

    Ok(terms.into_iter().map(|(term, _)| term).collect())
}