use serde::{Deserialize, Serialize};

const SERVER_URL: &str = "http://localhost:3000";

#[derive(Serialize)]
struct TokenRequest<'a> {
    #[serde(rename = "trialSessionId")]
    trial_session_id: &'a str,
}

#[derive(Deserialize, Serialize)]
pub struct DeepgramTokenResponse {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "expiresIn")]
    pub expires_in: u64,
}

/// Requests a real, short-lived Deepgram token from the broker for a
/// trial session. Fails with a clear error if the trial has expired or
/// hit its usage cap — callers should treat that as "show Trial Ended."
pub async fn request_deepgram_token(trial_session_id: &str) -> Result<DeepgramTokenResponse, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/broker/deepgram-token", SERVER_URL))
        .json(&TokenRequest { trial_session_id })
        .send()
        .await
        .map_err(|e| format!("Broker request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(text);
    }

    response
        .json::<DeepgramTokenResponse>()
        .await
        .map_err(|e| format!("Failed to parse broker response: {}", e))
}