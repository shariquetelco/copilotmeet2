use rusqlite::Connection;
use chrono::Utc;

/// Each migration is a (version, sql) pair. Add new ones to the end of this list.
/// Never edit or remove an existing entry once it has shipped, only append.
const MIGRATIONS: &[(&str, &str)] = &[
    (
        "001_add_project_color",
        "ALTER TABLE projects ADD COLUMN color TEXT NOT NULL DEFAULT 'blue';",
    ),
    (
        "002_add_document_status",
        "ALTER TABLE documents ADD COLUMN status TEXT NOT NULL DEFAULT 'uploaded';",
    ),
    (
        "003_create_document_jobs",
        "CREATE TABLE IF NOT EXISTS document_jobs (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            stage TEXT NOT NULL DEFAULT 'pending',
            error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );",
    ),
];

pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    for (version, sql) in MIGRATIONS {
        let already_applied: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
                [version],
                |row| row.get::<_, i64>(0),
            )
            .map(|count| count > 0)
            .unwrap_or(false);

        if !already_applied {
            conn.execute(sql, [])?;
            conn.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
                (version, Utc::now().to_rfc3339()),
            )?;
        }
    }
    Ok(())
}