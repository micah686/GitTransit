import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './database';

describe('migration safety', () => {
	it('upgrades a phase-8 database and rolls back an interrupted migration transaction', () => {
		const db = openDatabase(':memory:');
		try {
			expect(
				(
					db.prepare('SELECT MAX(version) version FROM schema_migrations').get() as {
						version: number;
					}
				).version
			).toBe(6);
			expect(
				(
					db
						.prepare(
							"SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name='notification_endpoints'"
						)
						.get() as { count: number }
				).count
			).toBe(1);
		} finally {
			db.close();
		}

		const interrupted = new Database(':memory:');
		try {
			interrupted.exec(
				'CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at INTEGER NOT NULL)'
			);
			const migration = fs.readFileSync(path.resolve('migrations/0006_notifications.sql'), 'utf8');
			const apply = interrupted.transaction(() => {
				interrupted.exec('CREATE TABLE users(id TEXT PRIMARY KEY)');
				interrupted.exec(migration);
				throw new Error('simulated interruption');
			});
			expect(() => apply.immediate()).toThrow('simulated interruption');
			expect(
				(
					interrupted
						.prepare(
							"SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name='notification_endpoints'"
						)
						.get() as { count: number }
				).count
			).toBe(0);
		} finally {
			interrupted.close();
		}
	});

	it('upgrades an existing phase-8 database without losing control-plane data', () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gittransit-upgrade-'));
		const filename = path.join(directory, 'upgrade.sqlite');
		try {
			const previous = openDatabase(filename);
			previous
				.prepare('INSERT INTO users(id,email,password_hash,role,created_at)VALUES(?,?,?,?,?)')
				.run('phase-8-owner', 'upgrade@test.invalid', 'hash', 'admin', 1);
			previous.exec(
				'DROP TABLE notification_deliveries; DROP TABLE notification_endpoints; DELETE FROM schema_migrations WHERE version=6'
			);
			previous.close();

			const upgraded = openDatabase(filename);
			try {
				expect(
					(
						upgraded.prepare('SELECT email FROM users WHERE id=?').get('phase-8-owner') as {
							email: string;
						}
					).email
				).toBe('upgrade@test.invalid');
				expect(
					(
						upgraded.prepare('SELECT MAX(version) version FROM schema_migrations').get() as {
							version: number;
						}
					).version
				).toBe(6);
			} finally {
				upgraded.close();
			}
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});
});
