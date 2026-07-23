use rusqlite::{Connection, params, Result, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Document {
    pub id: String,
    pub project_id: String,
    pub file_name: String,
    pub file_path: String,
    pub file_size_bytes: i64,
    pub file_type: String,
    pub status: String,
    pub created_at: String,
}

pub struct DocumentRepository;

impl DocumentRepository {
    pub fn create(conn: &Connection, doc: &Document) -> Result<()> {
        conn.execute(
            "INSERT INTO documents (id, project_id, file_name, file_path, file_size_bytes, file_type, hash, status, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, '', ?7, ?8)",
            params![
                doc.id,
                doc.project_id,
                doc.file_name,
                doc.file_path,
                doc.file_size_bytes,
                doc.file_type,
                doc.status,
                doc.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_by_project(conn: &Connection, project_id: &str) -> Result<Vec<Document>> {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, file_name, file_path, file_size_bytes, file_type, status, created_at
             FROM documents WHERE project_id = ?1 ORDER BY created_at DESC",
        )?;

        let rows = stmt.query_map(params![project_id], |row| {
            Ok(Document {
                id: row.get(0)?,
                project_id: row.get(1)?,
                file_name: row.get(2)?,
                file_path: row.get(3)?,
                file_size_bytes: row.get(4)?,
                file_type: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;

        rows.collect()
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<()> {
        conn.execute("DELETE FROM documents WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn update_status(conn: &Connection, id: &str, status: &str) -> Result<()> {
        conn.execute(
            "UPDATE documents SET status = ?1 WHERE id = ?2",
            params![status, id],
        )?;
        Ok(())
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Document>> {
        conn.query_row(
            "SELECT id, project_id, file_name, file_path, file_size_bytes, file_type, status, created_at
             FROM documents WHERE id = ?1",
            params![id],
            |row| {
                Ok(Document {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    file_name: row.get(2)?,
                    file_path: row.get(3)?,
                    file_size_bytes: row.get(4)?,
                    file_type: row.get(5)?,
                    status: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .optional()
    }

    pub fn total_size_for_project(conn: &Connection, project_id: &str) -> Result<i64> {
        conn.query_row(
            "SELECT COALESCE(SUM(file_size_bytes), 0) FROM documents WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )
    }
}