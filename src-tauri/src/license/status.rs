use rusqlite::Connection;
use std::time::{SystemTime, UNIX_EPOCH};

use super::mode::AppMode;
use super::verify::LicenseClaims;
use crate::repositories::settings::SettingsRepository;

pub const TOKEN_KEY: &str = "license.token";
pub const LAST_VERIFIED_KEY: &str = "license.last_verified_at";
pub const GRACE_DAYS: i64 = 30;

pub fn now_secs() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64
}

pub fn read_token(conn: &Connection) -> Option<String> {
    SettingsRepository::get(conn, TOKEN_KEY).ok().flatten()
}

pub fn read_last_verified(conn: &Connection) -> i64 {
    SettingsRepository::get(conn, LAST_VERIFIED_KEY)
        .ok()
        .flatten()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0)
}

pub fn store_token(conn: &Connection, token: &str) -> Result<(), String> {
    let timestamp = now_secs().to_string();
    SettingsRepository::set(conn, TOKEN_KEY, token, &timestamp).map_err(|e| e.to_string())?;
    SettingsRepository::set(conn, LAST_VERIFIED_KEY, &timestamp, &timestamp)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn mode_from_claims(claims: &LicenseClaims) -> AppMode {
    if claims.token_type == "trial" {
        AppMode::Trial { expires_at: claims.exp }
    } else {
        AppMode::Licensed
    }
}