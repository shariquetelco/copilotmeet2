use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

use super::keys::LICENSE_PUBLIC_KEY;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseClaims {
    #[serde(rename = "licenseId")]
    pub license_id: Option<String>,
    #[serde(rename = "trialSessionId")]
    pub trial_session_id: Option<String>,
    pub plan: Option<String>,
    #[serde(rename = "maxDevices")]
    pub max_devices: Option<u32>,
    #[serde(rename = "deviceId")]
    pub device_id: String,
    #[serde(rename = "tokenVersion")]
    pub token_version: Option<u32>,
    #[serde(rename = "type")]
    pub token_type: String, // "license" or "trial"
    pub email: Option<String>,
    #[serde(rename = "activationCount")]
    pub activation_count: Option<u32>,
    #[serde(rename = "storageLimitMbPerProject")]
    pub storage_limit_mb_per_project: Option<u32>,
    pub exp: usize,
    pub iat: usize,
}

/// Verifies a license/trial JWT's signature and expiry entirely offline,
/// using the embedded public key. Does NOT check revocation or
/// tokenVersion staleness — that requires the server, this only proves
/// the token is authentic and not expired.
pub fn verify_token(token: &str) -> Result<LicenseClaims, String> {
    let decoding_key = DecodingKey::from_ec_pem(LICENSE_PUBLIC_KEY.as_bytes())
        .map_err(|e| format!("Invalid public key: {}", e))?;

    let mut validation = Validation::new(Algorithm::ES256);
    validation.validate_exp = true;

    let token_data = decode::<LicenseClaims>(token, &decoding_key, &validation)
        .map_err(|e| format!("Token verification failed: {}", e))?;

    Ok(token_data.claims)
}

/// Same signature check, but ignores expiry — used only to read claims
/// out of a token that's already expired, so we can calculate how long
/// ago it was issued for the offline-grace window. Still cryptographically
/// verified, still can't be forged, just doesn't reject on age.
pub enum TokenCheckResult {
    Valid(LicenseClaims),
    Expired(LicenseClaims),
    Invalid,
}

pub fn check_token(token: &str) -> TokenCheckResult {
    match verify_token(token) {
        Ok(claims) => TokenCheckResult::Valid(claims),
        Err(_) => match read_expired_claims(token) {
            Ok(claims) => TokenCheckResult::Expired(claims),
            Err(_) => TokenCheckResult::Invalid,
        },
    }
}

/// Same signature check, but ignores expiry
pub fn read_expired_claims(token: &str) -> Result<LicenseClaims, String> {
    let decoding_key = DecodingKey::from_ec_pem(LICENSE_PUBLIC_KEY.as_bytes())
        .map_err(|e| format!("Invalid public key: {}", e))?;

    let mut validation = Validation::new(Algorithm::ES256);
    validation.validate_exp = false;

    let token_data = decode::<LicenseClaims>(token, &decoding_key, &validation)
        .map_err(|e| format!("Token verification failed: {}", e))?;

    Ok(token_data.claims)
}