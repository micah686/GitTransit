import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '$lib/server/persistence/database';
import type { AuthenticatedSession, SafeUser } from './types';

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const DUMMY_PASSWORD_HASH =
	'$argon2id$v=19$m=19456,t=2,p=1$quItLMQ1WuJ0Q5pHN6qNOQ$i8s+EnW/CJPh58mCzrIv2h2rAbWGOF0PnLHmbV5/+/Y';

export class SetupClosedError extends Error {}
export class InvalidCredentialsError extends Error {}
export class LoginThrottledError extends Error {}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex');

function validEmail(email: string): boolean {
	return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCredentials(email: string, password: string): string {
	const normalized = normalizeEmail(email);
	if (!validEmail(normalized)) throw new Error('Enter a valid email address.');
	if (password.length < 12 || password.length > 1024) {
		throw new Error('Password must be between 12 and 1024 characters.');
	}
	return normalized;
}

export class AuthService {
	constructor(
		private readonly db: SqliteDatabase,
		private readonly now: () => number = Date.now
	) {}

	isSetupRequired(): boolean {
		return (
			(this.db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count ===
			0
		);
	}

	async createFirstAdmin(email: string, password: string): Promise<SafeUser> {
		const normalized = validateCredentials(email, password);
		const passwordHash = await hash(password, {
			algorithm: 2,
			memoryCost: 19_456,
			timeCost: 2,
			parallelism: 1,
			outputLen: 32
		});
		const user: SafeUser = { id: randomUUID(), email: normalized, role: 'admin' };
		const insert = this.db.transaction(() => {
			const count = (
				this.db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }
			).count;
			if (count !== 0) throw new SetupClosedError('Initial setup is already complete.');
			this.db
				.prepare(
					'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
				)
				.run(user.id, user.email, passwordHash, user.role, this.now());
		});
		insert.immediate();
		return user;
	}

	async login(
		email: string,
		password: string,
		clientKey: string
	): Promise<{ session: AuthenticatedSession; token: string }> {
		const normalized = normalizeEmail(email);
		const attemptKey = tokenHash(`${normalized}\0${clientKey}`);
		this.assertNotThrottled(attemptKey);
		const row = this.db
			.prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?')
			.get(normalized) as
			{ id: string; email: string; password_hash: string; role: 'admin' | 'member' } | undefined;
		const accepted = await verify(row?.password_hash ?? DUMMY_PASSWORD_HASH, password);
		if (!row || !accepted) {
			this.recordFailure(attemptKey);
			throw new InvalidCredentialsError('Email or password is incorrect.');
		}
		this.db.prepare('DELETE FROM login_attempts WHERE key = ?').run(attemptKey);
		return this.createSession({ id: row.id, email: row.email, role: row.role });
	}

	createSession(user: SafeUser): { session: AuthenticatedSession; token: string } {
		const token = randomBytes(32).toString('base64url');
		const createdAt = this.now();
		const session: AuthenticatedSession = {
			id: randomUUID(),
			user,
			expiresAt: new Date(createdAt + SESSION_LIFETIME_MS)
		};
		this.db
			.prepare(
				'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.run(
				session.id,
				user.id,
				tokenHash(token),
				session.expiresAt.getTime(),
				createdAt,
				createdAt
			);
		return { session, token };
	}

	resolveSession(token: string | undefined): AuthenticatedSession | null {
		if (!token) return null;
		const now = this.now();
		const row = this.db
			.prepare(
				`SELECT s.id, s.expires_at, u.id AS user_id, u.email, u.role
				 FROM sessions s JOIN users u ON u.id = s.user_id
				 WHERE s.token_hash = ? AND s.expires_at > ?`
			)
			.get(tokenHash(token), now) as
			| { id: string; expires_at: number; user_id: string; email: string; role: 'admin' | 'member' }
			| undefined;
		if (!row) return null;
		this.db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(now, row.id);
		return {
			id: row.id,
			expiresAt: new Date(row.expires_at),
			user: { id: row.user_id, email: row.email, role: row.role }
		};
	}

	revokeSession(token: string | undefined): void {
		if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
	}

	private assertNotThrottled(key: string): void {
		const row = this.db
			.prepare('SELECT blocked_until FROM login_attempts WHERE key = ?')
			.get(key) as { blocked_until: number | null } | undefined;
		if (row?.blocked_until && row.blocked_until > this.now()) {
			throw new LoginThrottledError('Too many attempts. Try again later.');
		}
	}

	private recordFailure(key: string): void {
		const now = this.now();
		const row = this.db
			.prepare('SELECT failures, window_started_at FROM login_attempts WHERE key = ?')
			.get(key) as { failures: number; window_started_at: number } | undefined;
		const failures = !row || now - row.window_started_at > ATTEMPT_WINDOW_MS ? 1 : row.failures + 1;
		const windowStart =
			!row || now - row.window_started_at > ATTEMPT_WINDOW_MS ? now : row.window_started_at;
		const blockedUntil = failures >= MAX_FAILURES ? now + BLOCK_MS : null;
		this.db
			.prepare(
				`INSERT INTO login_attempts (key, failures, window_started_at, blocked_until) VALUES (?, ?, ?, ?)
				 ON CONFLICT(key) DO UPDATE SET failures=excluded.failures, window_started_at=excluded.window_started_at,
				 blocked_until=excluded.blocked_until`
			)
			.run(key, failures, windowStart, blockedUntil);
	}
}
