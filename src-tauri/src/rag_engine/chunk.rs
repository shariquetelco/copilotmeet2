/// Splits cleaned text into overlapping chunks suitable for embedding.
/// Word-based (not character-based) so we don't cut words in half.
/// Overlap preserves context across chunk boundaries so a fact
/// split across two chunks is still findable from either one.
pub fn chunk_text(text: &str, chunk_size_words: usize, overlap_words: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return vec![];
    }

    let mut chunks = Vec::new();
    let step = chunk_size_words.saturating_sub(overlap_words).max(1);
    let mut start = 0;

    while start < words.len() {
        let end = (start + chunk_size_words).min(words.len());
        let chunk = words[start..end].join(" ");
        chunks.push(chunk);

        if end == words.len() {
            break;
        }
        start += step;
    }

    chunks
}

pub const DEFAULT_CHUNK_SIZE_WORDS: usize = 250;
pub const DEFAULT_OVERLAP_WORDS: usize = 40;