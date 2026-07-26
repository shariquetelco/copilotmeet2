use serde::{Deserialize, Serialize};

const SERVER_URL: &str = "http://localhost:3000";

pub enum BrokerIdentity {
    Trial(String),
    License(String),
}

impl BrokerIdentity {
    fn to_json(&self) -> serde_json::Value {
        match self {
            BrokerIdentity::Trial(id) => serde_json::json!({ "trialSessionId": id }),
            BrokerIdentity::License(id) => serde_json::json!({ "licenseId": id }),
        }
    }
}

#[derive(Deserialize, Serialize)]
pub struct DeepgramTokenResponse {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "expiresIn")]
    pub expires_in: u64,
}

use futures_util::StreamExt;

/// Sends a prompt through the broker's Groq proxy during a trial. Same
/// streaming shape as llm_engine::ask_stream, so the caller doesn't need
/// to know or care whether the answer came from BYOK or the broker.
pub async fn ask_groq_stream<F: FnMut(&str) + Send>(
    identity: &BrokerIdentity,
    prompt: &str,
    mut on_token: F,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut body = identity.to_json();
    body["provider"] = serde_json::json!("groq");
    body["prompt"] = serde_json::json!(prompt);

    let response = client
        .post(format!("{}/api/broker/ask", SERVER_URL))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Broker request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(text);
    }

    let mut full_answer = String::new();
    let mut buffer = String::new();
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer.drain(..=pos);

            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    continue;
                }
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(content) = parsed["choices"][0]["delta"]["content"].as_str() {
                        full_answer.push_str(content);
                        on_token(content);
                    }
                }
            }
        }
    }

    Ok(full_answer)
}

/// Requests a real, short-lived Deepgram token from the broker for a
/// trial session. Fails with a clear error if the trial has expired or
/// hit its usage cap — callers should treat that as "show Trial Ended."
pub async fn request_deepgram_token(identity: &BrokerIdentity) -> Result<DeepgramTokenResponse, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/broker/deepgram-token", SERVER_URL))
        .json(&identity.to_json())
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