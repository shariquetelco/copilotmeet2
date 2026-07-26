use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QaEntry {
    pub id: String,
    pub session_id: String,
    pub question: String,
    pub rag_answer: Option<String>,
    pub rag_confidence: Option<i32>,
    pub llm_answer: Option<String>,
    pub llm_confidence: Option<i32>,
    pub answer_source: String,
    pub pinned: bool,
    pub timestamp: String,
}

pub struct QaEntryRepository;

impl QaEntryRepository {
    pub fn create(conn: &Connection, entry: &QaEntry) -> Result<()> {
        conn.execute(
            "INSERT INTO qa_entries (id, session_id, question, rag_answer, rag_confidence, llm_answer, llm_confidence, answer_source, pinned, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                entry.id,
                entry.session_id,
                entry.question,
                entry.rag_answer,
                entry.rag_confidence,
                entry.llm_answer,
                entry.llm_confidence,
                entry.answer_source,
                entry.pinned as i32,
                entry.timestamp,
            ],
        )?;
        Ok(())
    }

    /// Pulls Q&A history across every session for a project, newest first
    /// — this is the real data source the personalization/voice-profile
    /// feature will eventually analyze.
    pub fn list_by_project(conn: &Connection, project_id: &str, limit: u32) -> Result<Vec<QaEntry>> {
        let mut stmt = conn.prepare(
            "SELECT qa.id, qa.session_id, qa.question, qa.rag_answer, qa.rag_confidence,
                    qa.llm_answer, qa.llm_confidence, qa.answer_source, qa.pinned, qa.timestamp
             FROM qa_entries qa
             JOIN sessions s ON s.id = qa.session_id
             WHERE s.project_id = ?1
             ORDER BY qa.timestamp DESC
             LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![project_id, limit], |row| {
            Ok(QaEntry {
                id: row.get(0)?,
                session_id: row.get(1)?,
                question: row.get(2)?,
                rag_answer: row.get(3)?,
                rag_confidence: row.get(4)?,
                llm_answer: row.get(5)?,
                llm_confidence: row.get(6)?,
                answer_source: row.get(7)?,
                pinned: row.get::<_, i32>(8)? != 0,
                timestamp: row.get(9)?,
            })
        })?;
        rows.collect()
    }
}