use rusqlite::{Connection, params, Result, OptionalExtension};

pub struct ApiKeyRepository;

impl ApiKeyRepository {
    pub fn set(conn: &Connection, provider: &str, key: &str, updated_at: &str) -> Result<()> {
        conn.execute(
            "INSERT INTO api_keys (provider, encrypted_key, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(provider) DO UPDATE SET encrypted_key = excluded.encrypted_key, updated_at = excluded.updated_at",
            params![provider, key, updated_at],
        )?;
        Ok(())
    }

    pub fn get(conn: &Connection, provider: &str) -> Result<Option<String>> {
        conn.query_row(
            "SELECT encrypted_key FROM api_keys WHERE provider = ?1",
            params![provider],
            |row| row.get(0),
        )
        .optional()
    }

    pub fn delete(conn: &Connection, provider: &str) -> Result<()> {
        conn.execute("DELETE FROM api_keys WHERE provider = ?1", params![provider])?;
        Ok(())
    }
}