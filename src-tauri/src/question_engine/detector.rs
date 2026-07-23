use super::patterns::{AUX_STARTERS, IMPERATIVE_STARTERS, MEETING_FILLERS, WH_WORDS};

#[derive(Debug, PartialEq, Clone)]
pub enum QuestionClassification {
    RealQuestion,
    Ignore,
    Ambiguous,
}

#[derive(Debug, Clone)]
pub struct QuestionDecision {
    pub classification: QuestionClassification,
    pub confidence: f32,
    pub reason: String,
}

/// Fast, deterministic heuristic classifier — no LLM call, runs on every
/// line of a live transcript, so it must stay cheap. Ambiguous cases are
/// intentionally left for a later, optional LLM classification pass.
pub fn classify(text: &str) -> QuestionDecision {
    let lower = text.trim().to_lowercase();
    let lower = lower.trim_end_matches(['.', '!', '?']);

    if lower.is_empty() {
        return QuestionDecision {
            classification: QuestionClassification::Ignore,
            confidence: 1.0,
            reason: "Empty input".to_string(),
        };
    }

    for filler in MEETING_FILLERS {
        if lower.contains(filler) {
            return QuestionDecision {
                classification: QuestionClassification::Ignore,
                confidence: 0.95,
                reason: "Meeting filler".to_string(),
            };
        }
    }

    let first_word = lower.split_whitespace().next().unwrap_or("");

    if WH_WORDS.contains(&first_word) {
        return QuestionDecision {
            classification: QuestionClassification::RealQuestion,
            confidence: 0.9,
            reason: "WH word".to_string(),
        };
    }

    for imperative in IMPERATIVE_STARTERS {
        if lower.starts_with(imperative) {
            return QuestionDecision {
                classification: QuestionClassification::RealQuestion,
                confidence: 0.85,
                reason: "Imperative".to_string(),
            };
        }
    }

    if AUX_STARTERS.contains(&first_word) {
        return QuestionDecision {
            classification: QuestionClassification::RealQuestion,
            confidence: 0.75,
            reason: "Auxiliary verb".to_string(),
        };
    }

    if text.trim().ends_with('?') {
        return QuestionDecision {
            classification: QuestionClassification::RealQuestion,
            confidence: 0.6,
            reason: "Ends with question mark".to_string(),
        };
    }

    let word_count = lower.split_whitespace().count();
    if word_count <= 2 {
        return QuestionDecision {
            classification: QuestionClassification::Ambiguous,
            confidence: 0.3,
            reason: "Too short to classify confidently".to_string(),
        };
    }

    QuestionDecision {
        classification: QuestionClassification::Ignore,
        confidence: 0.5,
        reason: "No question indicators found".to_string(),
    }
}