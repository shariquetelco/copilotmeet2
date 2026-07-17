use rusqlite::{Connection, params, Result, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocumentJob {
    pub id: String,
    pub document_id: String,
    pub stage: String,
    pub error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub struct DocumentJobRepository;

impl DocumentJobRepository {
    pub fn create(conn: &Connection, job: &DocumentJob) -> Result<()> {
        conn.execute(
            "INSERT INTO document_jobs (id, document_id, stage, error, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![job.id, job.document_id, job.stage, job.error, job.created_at, job.updated_at],
        )?;
        Ok(())
    }

    pub fn update_stage(
        conn: &Connection,
        document_id: &str,
        stage: &str,
        error: Option<&str>,
        updated_at: &str,
    ) -> Result<()> {
        conn.execute(
            "UPDATE document_jobs SET stage = ?1, error = ?2, updated_at = ?3 WHERE document_id = ?4",
            params![stage, error, updated_at, document_id],
        )?;
        Ok(())
    }

    pub fn get_by_document(conn: &Connection, document_id: &str) -> Result<Option<DocumentJob>> {
        conn.query_row(
            "SELECT id, document_id, stage, error, created_at, updated_at
             FROM document_jobs WHERE document_id = ?1",
            params![document_id],
            |row| {
                Ok(DocumentJob {
                    id: row.get(0)?,
                    document_id: row.get(1)?,
                    stage: row.get(2)?,
                    error: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            },
        )
        .optional()
    }
}