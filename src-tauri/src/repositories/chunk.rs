use rusqlite::{Connection, params, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Chunk {
    pub id: String,
    pub document_id: String,
    pub project_id: String,
    pub chunk_index: i32,
    pub content: String,
    pub created_at: String,
}

pub struct ChunkRepository;

impl ChunkRepository {
    pub fn create_many(conn: &Connection, chunks: &[Chunk]) -> Result<()> {
        for chunk in chunks {
            conn.execute(
                "INSERT INTO chunks (id, document_id, project_id, chunk_index, content, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    chunk.id,
                    chunk.document_id,
                    chunk.project_id,
                    chunk.chunk_index,
                    chunk.content,
                    chunk.created_at,
                ],
            )?;
        }
        Ok(())
    }

    pub fn list_by_project(conn: &Connection, project_id: &str) -> Result<Vec<Chunk>> {
        let mut stmt = conn.prepare(
            "SELECT id, document_id, project_id, chunk_index, content, created_at
             FROM chunks WHERE project_id = ?1",
        )?;

        let rows = stmt.query_map(params![project_id], |row| {
            Ok(Chunk {
                id: row.get(0)?,
                document_id: row.get(1)?,
                project_id: row.get(2)?,
                chunk_index: row.get(3)?,
                content: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        rows.collect()
    }

    pub fn list_by_document(conn: &Connection, document_id: &str) -> Result<Vec<Chunk>> {
        let mut stmt = conn.prepare(
            "SELECT id, document_id, project_id, chunk_index, content, created_at
             FROM chunks WHERE document_id = ?1 ORDER BY chunk_index ASC",
        )?;

        let rows = stmt.query_map(params![document_id], |row| {
            Ok(Chunk {
                id: row.get(0)?,
                document_id: row.get(1)?,
                project_id: row.get(2)?,
                chunk_index: row.get(3)?,
                content: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        rows.collect()
    }
}