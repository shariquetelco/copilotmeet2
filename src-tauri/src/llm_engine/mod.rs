use serde::{Deserialize, Serialize};

const GROQ_API_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL: &str = "llama-3.3-70b-versatile";

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: String,
}

/// Sends a prompt to Groq and returns the generated answer.
pub async fn ask_groq(api_key: &str, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();

    let body = ChatRequest {
        model: GROQ_MODEL.to_string(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: prompt.to_string(),
        }],
    };

    let response = client
        .post(GROQ_API_URL)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Groq request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Groq returned {}: {}", status, text));
    }

    let parsed: ChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Groq response: {}", e))?;

    parsed
        .choices
        .get(0)
        .map(|c| c.message.content.clone())
        .ok_or_else(|| "Groq returned no choices".to_string())
}