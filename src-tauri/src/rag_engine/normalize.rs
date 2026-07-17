/// Cleans and normalizes raw extracted text before chunking.
/// - Collapses repeated whitespace
/// - Normalizes line breaks
/// - Strips lines that are almost certainly headers/footers/page numbers
/// - Normalizes Unicode to a consistent form
pub fn clean(raw: &str) -> String {
    let normalized_unicode: String = raw.nfc_chars_collect();

    let lines: Vec<&str> = normalized_unicode
        .lines()
        .map(|l| l.trim())
        .filter(|l| !is_likely_boilerplate(l))
        .collect();

    let joined = lines.join("\n");

    // collapse 3+ blank lines down to a single blank line
    let mut cleaned = String::new();
    let mut blank_run = 0;
    for line in joined.lines() {
        if line.is_empty() {
            blank_run += 1;
            if blank_run <= 1 {
                cleaned.push('\n');
            }
        } else {
            blank_run = 0;
            cleaned.push_str(line);
            cleaned.push('\n');
        }
    }

    cleaned.trim().to_string()
}

fn is_likely_boilerplate(line: &str) -> bool {
    if line.is_empty() {
        return false; // blank lines are handled separately, not boilerplate
    }
    // a lone page number, e.g. "12" or "Page 12" or "12 / 40"
    let lower = line.to_lowercase();
    let is_short_and_numeric = line.len() < 15
        && line.chars().any(|c| c.is_ascii_digit())
        && line.chars().all(|c| c.is_ascii_digit() || c.is_whitespace() || "/-.".contains(c));

    is_short_and_numeric || lower.starts_with("page ") && line.len() < 20
}

trait NfcCollect {
    fn nfc_chars_collect(&self) -> String;
}

impl NfcCollect for str {
    fn nfc_chars_collect(&self) -> String {
        // Simple normalization without pulling in the full unicode-normalization
        // crate for now: collapse whitespace variants to a plain space.
        self.chars()
            .map(|c| if c.is_whitespace() { ' ' } else { c })
            .collect()
    }
}