import { getDb } from '../database.js';

export interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  metadata: string | null;
}

export function createSession(
  id: string,
  startedAt: string,
  metadata?: Record<string, unknown>,
): void {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO sessions (id, started_at, metadata) VALUES (?, ?, ?)',
  );
  stmt.run(id, startedAt, metadata ? JSON.stringify(metadata) : null);
}

export function getSessionById(id: string): SessionRow | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  return stmt.get(id) as SessionRow | undefined;
}

export function getAllSessions(): SessionRow[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM sessions ORDER BY started_at DESC');
  return stmt.all() as SessionRow[];
}

export function endSession(id: string, endedAt: string): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?');
  stmt.run(endedAt, id);
}

export function updateSessionMetadata(
  id: string,
  metadata: Record<string, unknown>,
): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE sessions SET metadata = ? WHERE id = ?');
  stmt.run(JSON.stringify(metadata), id);
}
