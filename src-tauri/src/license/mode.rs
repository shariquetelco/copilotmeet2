use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "mode")]
pub enum AppMode {
    Initializing,
    ActivationRequired,
    Trial { expires_at: usize },
    Licensed,
    Grace { days_remaining: i64 },
    Locked { reason: String },
}