mod patterns;
pub mod detector;

pub use detector::{classify, QuestionClassification, QuestionDecision};

#[cfg(test)]
mod tests;