import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '$lib/server/config';

export type SqliteDatabase = Database.Database;

const migration = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  window_started_at INTEGER NOT NULL,
  blocked_until INTEGER
);
`;

export function openDatabase(filename = config.databasePath): SqliteDatabase {
	if (filename !== ':memory:')
		fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
	const database = new Database(filename);
	database.pragma('foreign_keys = ON');
	database.pragma('journal_mode = WAL');
	database.pragma('busy_timeout = 5000');
	database.exec(migration);
	return database;
}

let instance: SqliteDatabase | undefined;
export function database(): SqliteDatabase {
	instance ??= openDatabase();
	return instance;
}

export function closeDatabase(): void {
	instance?.close();
	instance = undefined;
}
