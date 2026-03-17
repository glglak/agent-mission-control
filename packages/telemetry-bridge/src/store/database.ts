import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call openDatabase() first.');
  }
  return db;
}

export function openDatabase(dbPath: string): Database.Database {
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read/write performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  return db;
}

function runMigrations(database: Database.Database): void {
  // __dirname points to dist/store/ at runtime, but .sql files live in src/store/migrations/.
  // Resolve relative to package root (two levels up from dist/store/).
  const packageRoot = path.resolve(__dirname, '..', '..');
  const migrationsDir = path.join(packageRoot, 'src', 'store', 'migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    database.exec(sql);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
