use serde::{Deserialize, Serialize};

// Local dev for now — becomes api.copilotmeet.com once the server's deployed.
const SERVER_URL: &str = "https://copilotmeet-server.vercel.app";

#[derive(Serialize)]
struct ActivateRequest<'a> {
    #[serde(rename = "licenseKey")]
    license_key: &'a str,
    #[serde(rename = "deviceId")]
    device_id: &'a str,
}

#[derive(Serialize)]
struct CheckRequest<'a> {
    #[serde(rename = "licenseId")]
    license_id: &'a str,
    #[serde(rename = "deviceId")]
    device_id: &'a str,
    #[serde(rename = "tokenVersion")]
    token_version: u32,
}

#[derive(Serialize)]
struct TrialRequest<'a> {
    email: &'a str,
    #[serde(rename = "deviceId")]
    device_id: &'a str,
}

#[derive(Deserialize)]
struct TokenResponse {
    token: String,
}

#[derive(Deserialize)]
struct ErrorResponse {
    error: String,
}

async fn post_for_token(url: &str, body: impl Serialize) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = response.status();
    let text = response.text().await.unwrap_or_default();

    if !status.is_success() {
        let message = serde_json::from_str::<ErrorResponse>(&text)
            .map(|e| e.error)
            .unwrap_or(text);
        return Err(format!("{} ({})", message, status));
    }

    let parsed: TokenResponse =
        serde_json::from_str(&text).map_err(|e| format!("Failed to parse server response: {}", e))?;

    Ok(parsed.token)
}

pub async fn activate(license_key: &str, device_id: &str) -> Result<String, String> {
    post_for_token(
        &format!("{}/api/license/activate", SERVER_URL),
        ActivateRequest { license_key, device_id },
    )
    .await
}

pub async fn check(license_id: &str, device_id: &str, token_version: u32) -> Result<String, String> {
    post_for_token(
        &format!("{}/api/license/check", SERVER_URL),
        CheckRequest { license_id, device_id, token_version },
    )
    .await
}

pub async fn start_trial(email: &str, device_id: &str) -> Result<String, String> {
    post_for_token(
        &format!("{}/api/trial/start", SERVER_URL),
        TrialRequest { email, device_id },
    )
    .await
}