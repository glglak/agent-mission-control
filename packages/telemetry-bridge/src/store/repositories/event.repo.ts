import { getDb } from '../database.js';

export interface EventRow {
  event_id: string;
  timestamp: string;
  session_id: string;
  agent_id: string | null;
  event_type: string;
  payload: string | null;
}

export interface EventQuery {
  session_id?: string;
  event_type?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export function insertEvent(
  eventId: string,
  timestamp: string,
  sessionId: string,
  eventType: string,
  agentId?: string,
  payload?: Record<string, unknown>,
): void {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO events (event_id, timestamp, session_id, agent_id, event_type, payload) VALUES (?, ?, ?, ?, ?, ?)',
  );
  stmt.run(
    eventId,
    timestamp,
    sessionId,
    agentId ?? null,
    eventType,
    payload ? JSON.stringify(payload) : null,
  );
}

export function getEventById(eventId: string): EventRow | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM events WHERE event_id = ?');
  return stmt.get(eventId) as EventRow | undefined;
}

export function queryEvents(query: EventQuery): EventRow[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.session_id) {
    conditions.push('session_id = ?');
    params.push(query.session_id);
  }
  if (query.event_type) {
    conditions.push('event_type = ?');
    params.push(query.event_type);
  }
  if (query.from) {
    conditions.push('timestamp >= ?');
    params.push(query.from);
  }
  if (query.to) {
    conditions.push('timestamp <= ?');
    params.push(query.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = query.limit ? `LIMIT ${Number(query.limit)}` : 'LIMIT 1000';

  const sql = `SELECT * FROM events ${where} ORDER BY timestamp ASC ${limit}`;
  const stmt = db.prepare(sql);
  return stmt.all(...params) as EventRow[];
}

export function insertFileActivity(
  eventId: string,
  filePath: string,
  action: string,
  agentId: string | undefined,
  timestamp: string,
): void {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO file_activity (event_id, file_path, action, agent_id, timestamp) VALUES (?, ?, ?, ?, ?)',
  );
  stmt.run(eventId, filePath, action, agentId ?? null, timestamp);
}

export function insertTokenUsage(
  eventId: string,
  agentId: string | undefined,
  sessionId: string,
  promptTokens: number,
  completionTokens: number,
  model: string | undefined,
  timestamp: string,
): void {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO token_usage (event_id, agent_id, session_id, prompt_tokens, completion_tokens, model, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  stmt.run(eventId, agentId ?? null, sessionId, promptTokens, completionTokens, model ?? null, timestamp);
}

export function insertMessage(
  eventId: string,
  fromAgent: string,
  toAgent: string,
  content: string,
  timestamp: string,
): void {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO messages (event_id, from_agent, to_agent, content, timestamp) VALUES (?, ?, ?, ?, ?)',
  );
  stmt.run(eventId, fromAgent, toAgent, content, timestamp);
}
