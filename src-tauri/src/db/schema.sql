-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    meeting_mode TEXT NOT NULL DEFAULT 'Interview',
    llm_profile TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    hash TEXT NOT NULL,
    embedding_model TEXT,
    ocr_processed INTEGER NOT NULL DEFAULT 0,
    indexed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT,
    meeting_source TEXT NOT NULL DEFAULT 'Manual',
    status TEXT NOT NULL DEFAULT 'active',
    started_at TEXT NOT NULL,
    ended_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- QA Entries
CREATE TABLE IF NOT EXISTS qa_entries (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    rag_answer TEXT,
    rag_confidence INTEGER,
    llm_answer TEXT,
    llm_confidence INTEGER,
    answer_source TEXT NOT NULL DEFAULT 'RAG',
    pinned INTEGER NOT NULL DEFAULT 0,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- License
CREATE TABLE IF NOT EXISTS license (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    license_key TEXT,
    email TEXT,
    device_id TEXT,
    app_version TEXT,
    activated_at TEXT,
    last_validated_at TEXT,
    trial_started_at TEXT,
    status TEXT NOT NULL DEFAULT 'trial'
);

-- Settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- API Keys (encrypted individually, separate from settings)
CREATE TABLE IF NOT EXISTS api_keys (
    provider TEXT PRIMARY KEY,
    encrypted_key TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Companion
CREATE TABLE IF NOT EXISTS companion (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL DEFAULT 'CoPilot',
    type TEXT NOT NULL DEFAULT 'smiley',
    position TEXT NOT NULL DEFAULT 'bottom-right',
    opacity REAL NOT NULL DEFAULT 1.0,
    size TEXT NOT NULL DEFAULT 'medium',
    animation TEXT NOT NULL DEFAULT 'idle',
    enabled INTEGER NOT NULL DEFAULT 1
);

-- Models
CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    version TEXT,
    downloaded INTEGER NOT NULL DEFAULT 0,
    path TEXT,
    size_bytes INTEGER,
    active INTEGER NOT NULL DEFAULT 0
);

-- Updates
CREATE TABLE IF NOT EXISTS updates (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_checked TEXT,
    current_version TEXT NOT NULL,
    beta_enabled INTEGER NOT NULL DEFAULT 0
);