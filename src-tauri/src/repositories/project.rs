use rusqlite::{Connection, params, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub meeting_mode: String,
    pub llm_profile: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

pub struct ProjectRepository;

impl ProjectRepository {
    pub fn create(conn: &Connection, project: &Project) -> Result<()> {
        conn.execute(
            "INSERT INTO projects (id, name, meeting_mode, llm_profile, is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                project.id,
                project.name,
                project.meeting_mode,
                project.llm_profile,
                project.is_active as i32,
                project.created_at,
                project.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn list(conn: &Connection) -> Result<Vec<Project>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, meeting_mode, llm_profile, is_active, created_at, updated_at
             FROM projects ORDER BY updated_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                meeting_mode: row.get(2)?,
                llm_profile: row.get(3)?,
                is_active: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;

        rows.collect()
    }

    pub fn update(conn: &Connection, project: &Project) -> Result<()> {
        conn.execute(
            "UPDATE projects
             SET name = ?1, meeting_mode = ?2, llm_profile = ?3, is_active = ?4, updated_at = ?5
             WHERE id = ?6",
            params![
                project.name,
                project.meeting_mode,
                project.llm_profile,
                project.is_active as i32,
                project.updated_at,
                project.id,
            ],
        )?;
        Ok(())
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<()> {
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(())
    }
}