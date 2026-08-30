import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '$lib/server/config';

export type SqliteDatabase = Database.Database;

const migration = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
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

function applyMigrations(database: SqliteDatabase): void {
	const applied = database.prepare('SELECT 1 FROM schema_migrations WHERE version = ?');
	if (!applied.get(1)) {
		database
			.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)')
			.run(Date.now());
	}
	if (!applied.get(2)) {
		const filename = path.resolve('migrations/0002_control_plane.sql');
		const sql = fs.readFileSync(filename, 'utf8');
		const migrate = database.transaction(() => {
			database.exec(sql);
			database
				.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)')
				.run(Date.now());
		});
		migrate.immediate();
	}
	if (!applied.get(3)) {
		const sql = fs.readFileSync(path.resolve('migrations/0003_worker_heartbeats.sql'), 'utf8');
		const migrate = database.transaction(() => {
			database.exec(sql);
			database
				.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?)')
				.run(Date.now());
		});
		migrate.immediate();
	}
	if (!applied.get(4)) {
		const sql = fs.readFileSync(path.resolve('migrations/0004_safety_recovery.sql'), 'utf8');
		const migrate = database.transaction(() => {
			database.exec(sql);
			database
				.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (4, ?)')
				.run(Date.now());
		});
		migrate.immediate();
	}
	if (!applied.get(5)) {
		const sql = fs.readFileSync(path.resolve('migrations/0005_two_way_reconciliation.sql'), 'utf8');
		const migrate = database.transaction(() => {
			database.exec(sql);
			database
				.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (5, ?)')
				.run(Date.now());
		});
		migrate.immediate();
	}
}

export function openDatabase(filename = config.databasePath): SqliteDatabase {
	if (filename !== ':memory:')
		fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
	const database = new Database(filename);
	database.pragma('foreign_keys = ON');
	database.pragma('journal_mode = WAL');
	database.pragma('busy_timeout = 5000');
	database.exec(migration);
	applyMigrations(database);
	return database;
}

export function transaction<T>(db: SqliteDatabase, operation: () => T): T {
	return db.transaction(operation).immediate();
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
