/// Splits cleaned text into chunks suitable for embedding, respecting
/// paragraph boundaries so a chunk starts at a natural idea boundary
/// (a heading, a new topic) rather than mid-sentence. Only paragraphs
/// that exceed the target size on their own get further split by words.
pub fn chunk_text(text: &str, chunk_size_words: usize, overlap_words: usize) -> Vec<String> {
    let paragraphs: Vec<&str> = text
        .split('\n')
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect();

    if paragraphs.is_empty() {
        return vec![];
    }

    let mut chunks: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut current_word_count = 0;

    for paragraph in paragraphs {
        let paragraph_word_count = paragraph.split_whitespace().count();

        // a single paragraph longer than the target size gets its own
        // word-windowed split, rather than force-joining it with neighbors
        if paragraph_word_count > chunk_size_words {
            if !current.is_empty() {
                chunks.push(current.trim().to_string());
                current = String::new();
                current_word_count = 0;
            }
            chunks.extend(split_by_words(paragraph, chunk_size_words, overlap_words));
            continue;
        }

        // a short, heading-like line (e.g. "Defense Req MAC N/W?") always
        // starts a fresh chunk, rather than getting absorbed mid-chunk —
        // this keeps the section's own answer from being split away from
        // its heading, and keeps unrelated prior content out of this chunk
        let looks_like_heading = is_heading_like(paragraph);
        if looks_like_heading && !current.is_empty() {
            chunks.push(current.trim().to_string());
            current = String::new();
            current_word_count = 0;
        }

        // adding this paragraph would overflow the target size -> close
        // the current chunk and start a new one with this paragraph
        if current_word_count + paragraph_word_count > chunk_size_words && !current.is_empty() {
            chunks.push(current.trim().to_string());
            current = String::new();
            current_word_count = 0;
        }

        if !current.is_empty() {
            current.push_str("\n\n");
        }
        current.push_str(paragraph);
        current_word_count += paragraph_word_count;
    }

    if !current.is_empty() {
        chunks.push(current.trim().to_string());
    }

    chunks
}

/// A short line that reads like a title or question rather than a full
/// sentence — used to force a new chunk to start there instead of letting
/// it get merged mid-chunk with unrelated preceding content.
fn is_heading_like(paragraph: &str) -> bool {
    let trimmed = paragraph.trim();
    let word_count = trimmed.split_whitespace().count();

    word_count <= 8
        && trimmed.len() <= 80
        && (trimmed.ends_with('?') || !trimmed.ends_with(['.', ',', ';']))
}

/// Fallback for a single paragraph too long to keep whole: sliding
/// word-window split, same approach as before, just scoped to one paragraph.
fn split_by_words(text: &str, chunk_size_words: usize, overlap_words: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut chunks = Vec::new();
    let step = chunk_size_words.saturating_sub(overlap_words).max(1);
    let mut start = 0;

    while start < words.len() {
        let end = (start + chunk_size_words).min(words.len());
        chunks.push(words[start..end].join(" "));
        if end == words.len() {
            break;
        }
        start += step;
    }

    chunks
}

pub const DEFAULT_CHUNK_SIZE_WORDS: usize = 250;
pub const DEFAULT_OVERLAP_WORDS: usize = 40;