import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDatabase } from '$lib/server/persistence/database';
import {
	AuthService,
	InvalidCredentialsError,
	LoginThrottledError,
	SetupClosedError
} from './service';

let db: SqliteDatabase | undefined;
afterEach(() => db?.close());

describe('AuthService', () => {
	it('atomically closes first-user setup and creates an explicit admin', async () => {
		db = openDatabase(':memory:');
		const service = new AuthService(db);
		const user = await service.createFirstAdmin(
			'Admin@Example.com',
			'a sufficiently long password'
		);
		expect(user).toEqual(expect.objectContaining({ email: 'admin@example.com', role: 'admin' }));
		await expect(
			service.createFirstAdmin('other@example.com', 'another long password')
		).rejects.toBeInstanceOf(SetupClosedError);
		expect(service.isSetupRequired()).toBe(false);
	});

	it('stores only a password hash and resolves opaque, revocable sessions', async () => {
		db = openDatabase(':memory:');
		const service = new AuthService(db);
		const password = 'correct horse battery staple';
		const user = await service.createFirstAdmin('admin@example.com', password);
		const stored = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as {
			password_hash: string;
		};
		expect(stored.password_hash).not.toContain(password);
		expect(stored.password_hash).toMatch(/^\$argon2id\$/);
		const { token } = await service.login(user.email, password, '127.0.0.1');
		const sessionRow = db
			.prepare('SELECT token_hash FROM sessions ORDER BY created_at DESC LIMIT 1')
			.get() as { token_hash: string };
		expect(sessionRow.token_hash).not.toBe(token);
		expect(service.resolveSession(token)?.user).toEqual(user);
		service.revokeSession(token);
		expect(service.resolveSession(token)).toBeNull();
	});

	it('returns generic failures and throttles repeated login attempts', async () => {
		db = openDatabase(':memory:');
		const service = new AuthService(db);
		await service.createFirstAdmin('admin@example.com', 'correct horse battery staple');
		for (let attempt = 0; attempt < 5; attempt += 1) {
			await expect(service.login('admin@example.com', 'wrong', 'client')).rejects.toBeInstanceOf(
				InvalidCredentialsError
			);
		}
		await expect(service.login('admin@example.com', 'wrong', 'client')).rejects.toBeInstanceOf(
			LoginThrottledError
		);
	});
});
