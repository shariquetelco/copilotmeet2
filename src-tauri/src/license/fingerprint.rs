use sha2::{Digest, Sha256};

/// A stable identifier for this machine, combining the OS-level machine
/// GUID with the OS name and architecture. Hashed before use so we never
/// send or store the raw underlying identifier — only a fingerprint
/// derived from it. Same function will be reused for trial sessions,
/// so activation and trial abuse-prevention can never mismatch.
pub fn get_device_fingerprint() -> Result<String, String> {
    let raw_id = machine_uid::get().map_err(|e| format!("Failed to read machine ID: {}", e))?;

    let combined = format!("{}-{}-{}", raw_id, std::env::consts::OS, std::env::consts::ARCH);

    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    let result = hasher.finalize();

    Ok(format!("{:x}", result))
}