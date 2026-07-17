mod migrations;

use rusqlite::Connection;
use std::path::PathBuf;
use std::fs;

const SCHEMA: &str = include_str!("schema.sql");

pub fn get_db_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("copilotmeet.db")
}

pub fn init_db(app_data_dir: &PathBuf) -> Result<Connection, rusqlite::Error> {
    if !app_data_dir.exists() {
        fs::create_dir_all(app_data_dir).expect("Failed to create app data directory");
    }

    let db_path = get_db_path(app_data_dir);
    let conn = Connection::open(db_path)?;

    conn.execute_batch(SCHEMA)?;
    migrations::run_migrations(&conn)?;

    Ok(conn)
}