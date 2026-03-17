CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, ended_at TEXT, metadata TEXT);
CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT, registered_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'registered', FOREIGN KEY (session_id) REFERENCES sessions(id));
CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, session_id TEXT NOT NULL, agent_id TEXT, event_type TEXT NOT NULL, payload TEXT);
CREATE TABLE IF NOT EXISTS file_activity (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL, file_path TEXT NOT NULL, action TEXT NOT NULL, agent_id TEXT, timestamp TEXT NOT NULL, FOREIGN KEY (event_id) REFERENCES events(event_id));
CREATE TABLE IF NOT EXISTS token_usage (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL, agent_id TEXT, session_id TEXT NOT NULL, prompt_tokens INTEGER NOT NULL, completion_tokens INTEGER NOT NULL, model TEXT, timestamp TEXT NOT NULL, FOREIGN KEY (event_id) REFERENCES events(event_id));
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL, from_agent TEXT NOT NULL, to_agent TEXT NOT NULL, content TEXT NOT NULL, timestamp TEXT NOT NULL, FOREIGN KEY (event_id) REFERENCES events(event_id));
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_file_activity_path ON file_activity(file_path);
