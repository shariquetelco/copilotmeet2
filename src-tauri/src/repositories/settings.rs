use rusqlite::{Connection, params, Result, OptionalExtension};
use std::collections::HashMap;

pub struct SettingsRepository;

impl SettingsRepository {
    pub fn get(conn: &Connection, key: &str) -> Result<Option<String>> {
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
    }

    pub fn set(conn: &Connection, key: &str, value: &str, updated_at: &str) -> Result<()> {
        conn.execute(
            "INSERT INTO settings (key, value, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![key, value, updated_at],
        )?;
        Ok(())
    }

    pub fn get_all(conn: &Connection) -> Result<HashMap<String, String>> {
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut map = HashMap::new();
        for row in rows {
            let (k, v) = row?;
            map.insert(k, v);
        }
        Ok(map)
    }

    pub fn delete(conn: &Connection, key: &str) -> Result<()> {
        conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
        Ok(())
    }
}