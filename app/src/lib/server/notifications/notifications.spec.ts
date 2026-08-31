import { createHmac, randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase, type SqliteDatabase } from '../persistence/database';
import { CredentialEncryptionService } from '../crypto/credentials';
import { appendEvent } from '../events/store';
import { notificationAdapters } from './adapters';
import { NotificationService } from './service';
import type { NotificationEvent, NotificationTarget } from './types';

let db: SqliteDatabase | undefined;
afterEach(() => db?.close());

const event: NotificationEvent = {
	id: 'delivery-1',
	type: 'run.failed',
	resourceIds: ['run-1'],
	payload: { state: 'failed' },
	createdAt: 1
};

describe('notification adapters', () => {
	it.each([
		['ntfy', 'https://ntfy.example/topic'],
		['apprise', 'https://apprise.example/notify'],
		['gotify', 'https://gotify.example']
	] as const)('delivers through %s without exposing response bodies', async (kind, url) => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
		const target: NotificationTarget = {
			kind,
			url: new URL(url),
			config: { token: 'notification-token' }
		};
		await notificationAdapters(fetcher)[kind].deliver(target, event, AbortSignal.timeout(10_000));
		expect(fetcher).toHaveBeenCalledOnce();
		expect(fetcher.mock.calls[0]?.[1]?.method).toBe('POST');
	});

	it('signs webhook timestamp and exact payload with HMAC-SHA256', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
		await notificationAdapters(fetcher).webhook.deliver(
			{
				kind: 'webhook',
				url: new URL('https://hooks.example/gittransit'),
				config: { secret: 'a sufficiently long signing secret' }
			},
			event,
			AbortSignal.timeout(10_000)
		);
		const init = fetcher.mock.calls[0]?.[1];
		const headers = init?.headers as Record<string, string>;
		const body = String(init?.body);
		const expected = createHmac('sha256', 'a sufficiently long signing secret')
			.update(`${headers['x-gittransit-timestamp']}.${body}`)
			.digest('hex');
		expect(headers['x-gittransit-signature']).toBe(`sha256=${expected}`);
		expect(headers['x-gittransit-delivery']).toBe(event.id);
	});
});

describe('notification outbox', () => {
	it('requires explicit permission for private-network and insecure HTTP targets', () => {
		db = openDatabase(':memory:');
		const owner = randomUUID();
		db.prepare('INSERT INTO users(id,email,password_hash,role,created_at)VALUES(?,?,?,?,?)').run(
			owner,
			'private-notify@test.invalid',
			'hash',
			'admin',
			Date.now()
		);
		const service = new NotificationService(
			db,
			new CredentialEncryptionService(Buffer.alloc(32, 9))
		);
		expect(() =>
			service.create(owner, {
				name: 'Local Gotify',
				kind: 'gotify',
				url: 'http://127.0.0.1:8080',
				token: 'token'
			})
		).toThrow('HTTPS');
		expect(() =>
			service.create(owner, {
				name: 'Local Gotify',
				kind: 'gotify',
				url: 'http://127.0.0.1:8080',
				token: 'token',
				allowInsecureHttp: true
			})
		).not.toThrow();
	});

	it('encrypts secrets, snapshots matching events, and delivers independently', async () => {
		db = openDatabase(':memory:');
		const owner = randomUUID();
		db.prepare('INSERT INTO users(id,email,password_hash,role,created_at)VALUES(?,?,?,?,?)').run(
			owner,
			'notify@test.invalid',
			'hash',
			'admin',
			Date.now()
		);
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
		const service = new NotificationService(
			db,
			new CredentialEncryptionService(Buffer.alloc(32, 7)),
			fetcher
		);
		const id = service.create(owner, {
			name: 'Ops webhook',
			kind: 'webhook',
			url: 'https://hooks.example/gittransit',
			secret: 'secret-that-must-not-leak',
			eventFilters: ['run.failed']
		});
		const stored = db
			.prepare('SELECT encrypted_config FROM notification_endpoints WHERE id=?')
			.get(id) as { encrypted_config: string };
		expect(stored.encrypted_config).not.toContain('secret-that-must-not-leak');
		expect(JSON.stringify(service.list(owner))).not.toContain('secret-that-must-not-leak');
		appendEvent(db, owner, 'run.succeeded', ['ignored'], { state: 'succeeded' });
		appendEvent(db, owner, 'run.failed', ['run-1'], { state: 'failed' });
		expect(
			(db.prepare('SELECT COUNT(*) count FROM notification_deliveries').get() as { count: number })
				.count
		).toBe(1);
		expect(await service.dispatchNext('worker', AbortSignal.timeout(10_000))).toBe(true);
		expect(
			(db.prepare('SELECT state FROM notification_deliveries').get() as { state: string }).state
		).toBe('delivered');
		expect(fetcher).toHaveBeenCalledOnce();
	});
});
