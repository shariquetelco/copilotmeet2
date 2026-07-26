use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Session {
    pub id: String,
    pub project_id: Option<String>,
    pub title: Option<String>,
    pub meeting_source: String,
    pub status: String,
    pub started_at: String,
    pub ended_at: Option<String>,
}

pub struct SessionRepository;

impl SessionRepository {
    pub fn create(conn: &Connection, session: &Session) -> Result<()> {
        conn.execute(
            "INSERT INTO sessions (id, project_id, title, meeting_source, status, started_at, ended_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                session.id,
                session.project_id,
                session.title,
                session.meeting_source,
                session.status,
                session.started_at,
                session.ended_at,
            ],
        )?;
        Ok(())
    }

    pub fn end_session(conn: &Connection, id: &str, ended_at: &str) -> Result<()> {
        conn.execute(
            "UPDATE sessions SET status = 'ended', ended_at = ?1 WHERE id = ?2",
            params![ended_at, id],
        )?;
        Ok(())
    }

    pub fn list_by_project(conn: &Connection, project_id: &str) -> Result<Vec<Session>> {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, meeting_source, status, started_at, ended_at
             FROM sessions WHERE project_id = ?1 ORDER BY started_at DESC",
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(Session {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                meeting_source: row.get(3)?,
                status: row.get(4)?,
                started_at: row.get(5)?,
                ended_at: row.get(6)?,
            })
        })?;
        rows.collect()
    }
}