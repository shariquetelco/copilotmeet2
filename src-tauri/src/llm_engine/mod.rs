use futures_util::StreamExt;
use serde::{Deserialize, Serialize};

const GROQ_API_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL: &str = "llama-3.3-70b-versatile";

const OPENAI_API_URL: &str = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL: &str = "gpt-4o-mini";

const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL: &str = "claude-3-5-sonnet-20241022";
const CLAUDE_API_VERSION: &str = "2023-06-01";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LlmProvider {
    Groq,
    OpenAI,
    Claude,
}

impl LlmProvider {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "groq" => Some(LlmProvider::Groq),
            "openai" => Some(LlmProvider::OpenAI),
            "claude" => Some(LlmProvider::Claude),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            LlmProvider::Groq => "groq",
            LlmProvider::OpenAI => "openai",
            LlmProvider::Claude => "claude",
        }
    }
}

pub async fn ask(provider: LlmProvider, api_key: &str, prompt: &str) -> Result<String, String> {
    match provider {
        LlmProvider::Groq => ask_groq(api_key, prompt).await,
        LlmProvider::OpenAI => ask_openai(api_key, prompt).await,
        LlmProvider::Claude => ask_claude(api_key, prompt).await,
    }
}

/// Same as `ask`, but calls `on_token` as each piece of the answer arrives.
/// Claude doesn't have streaming wired yet, so it falls back to one big
/// "chunk" delivered all at once — callers don't need special-case logic.
pub async fn ask_stream<F: FnMut(&str) + Send>(
    provider: LlmProvider,
    api_key: &str,
    prompt: &str,
    mut on_token: F,
) -> Result<String, String> {
    match provider {
        LlmProvider::Groq => {
            ask_openai_compatible_stream(GROQ_API_URL, GROQ_MODEL, api_key, prompt, on_token).await
        }
        LlmProvider::OpenAI => {
            ask_openai_compatible_stream(OPENAI_API_URL, OPENAI_MODEL, api_key, prompt, on_token).await
        }
        LlmProvider::Claude => {
            let answer = ask_claude(api_key, prompt).await?;
            on_token(&answer);
            Ok(answer)
        }
    }
}

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

async fn ask_openai_compatible(
    url: &str,
    model: &str,
    api_key: &str,
    prompt: &str,
    provider_name: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let body = ChatRequest {
        model: model.to_string(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: prompt.to_string(),
        }],
    };

    let response = client
        .post(url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("{} request failed: {}", provider_name, e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("{} returned {}: {}", provider_name, status, text));
    }

    let parsed: ChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse {} response: {}", provider_name, e))?;

    parsed
        .choices
        .get(0)
        .map(|c| c.message.content.clone())
        .ok_or_else(|| format!("{} returned no choices", provider_name))
}

pub async fn ask_groq(api_key: &str, prompt: &str) -> Result<String, String> {
    ask_openai_compatible(GROQ_API_URL, GROQ_MODEL, api_key, prompt, "Groq").await
}

pub async fn ask_openai(api_key: &str, prompt: &str) -> Result<String, String> {
    ask_openai_compatible(OPENAI_API_URL, OPENAI_MODEL, api_key, prompt, "OpenAI").await
}

#[derive(Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
}

#[derive(Deserialize)]
struct StreamDelta {
    content: Option<String>,
}

async fn ask_openai_compatible_stream<F: FnMut(&str) + Send>(
    url: &str,
    model: &str,
    api_key: &str,
    prompt: &str,
    mut on_token: F,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "model": model,
        "messages": [{ "role": "user", "content": prompt }],
        "stream": true,
    });

    let response = client
        .post(url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Streaming request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Streaming request returned {}: {}", status, text));
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
                if let Ok(parsed) = serde_json::from_str::<StreamChunk>(data) {
                    if let Some(choice) = parsed.choices.get(0) {
                        if let Some(content) = &choice.delta.content {
                            full_answer.push_str(content);
                            on_token(content);
                        }
                    }
                }
            }
        }
    }

    Ok(full_answer)
}

#[derive(Serialize)]
struct ClaudeMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ClaudeMessage>,
}

#[derive(Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContentBlock>,
}

#[derive(Deserialize)]
struct ClaudeContentBlock {
    text: String,
}

pub async fn ask_claude(api_key: &str, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();

    let body = ClaudeRequest {
        model: CLAUDE_MODEL.to_string(),
        max_tokens: 1024,
        messages: vec![ClaudeMessage {
            role: "user".to_string(),
            content: prompt.to_string(),
        }],
    };

    let response = client
        .post(CLAUDE_API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", CLAUDE_API_VERSION)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Claude request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Claude returned {}: {}", status, text));
    }

    let parsed: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Claude response: {}", e))?;

    parsed
        .content
        .get(0)
        .map(|c| c.text.clone())
        .ok_or_else(|| "Claude returned no content".to_string())
}