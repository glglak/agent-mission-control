import { getDb } from '../database.js';

export interface AgentRow {
  id: string;
  session_id: string;
  name: string;
  type: string | null;
  registered_at: string;
  status: string;
}

export function createAgent(
  id: string,
  sessionId: string,
  name: string,
  registeredAt: string,
  type?: string,
): void {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO agents (id, session_id, name, type, registered_at, status) VALUES (?, ?, ?, ?, ?, ?)',
  );
  stmt.run(id, sessionId, name, type ?? null, registeredAt, 'registered');
}

export function getAgentById(id: string): AgentRow | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM agents WHERE id = ?');
  return stmt.get(id) as AgentRow | undefined;
}

export function getAgentsBySession(sessionId: string): AgentRow[] {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT * FROM agents WHERE session_id = ? ORDER BY registered_at ASC',
  );
  return stmt.all(sessionId) as AgentRow[];
}

export function updateAgentStatus(id: string, status: string): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE agents SET status = ? WHERE id = ?');
  stmt.run(status, id);
}

export function getAllAgents(): AgentRow[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM agents ORDER BY registered_at DESC');
  return stmt.all() as AgentRow[];
}
