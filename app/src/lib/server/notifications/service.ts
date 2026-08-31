import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '../persistence/database';
import { database, transaction } from '../persistence/database';
import { config } from '../config';
import {
	CredentialEncryptionService,
	loadEncryptionKey,
	type EncryptedSecret
} from '../crypto/credentials';
import { notificationAdapters } from './adapters';
import type {
	NotificationConfig,
	NotificationEvent,
	NotificationKind,
	NotificationTarget
} from './types';
import { NotificationDeliveryError } from './types';

const DEFAULT_EVENTS = ['run.failed', 'run.partial', 'run.conflicted', 'run.awaiting-approval'];

export interface SafeNotificationEndpoint {
	readonly id: string;
	readonly name: string;
	readonly kind: NotificationKind;
	readonly url: string;
	readonly enabled: boolean;
	readonly eventFilters: readonly string[];
	readonly configuredSecret: boolean;
	readonly lastTestAt: number | null;
	readonly lastTestStatus: string | null;
	readonly safeErrorCode: string | null;
	readonly queued: number;
	readonly failed: number;
}

interface EndpointRow {
	id: string;
	user_id: string;
	name: string;
	kind: NotificationKind;
	url: string;
	encrypted_config: string;
	event_filters_json: string;
	enabled: number;
	last_test_at: number | null;
	last_test_status: string | null;
	safe_error_code: string | null;
}

function privateHostname(hostname: string): boolean {
	const value = hostname.toLowerCase().replace(/^\[|\]$/gu, '');
	if (
		value === 'localhost' ||
		value === '::1' ||
		(value.includes(':') &&
			(value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')))
	)
		return true;
	const parts = value.split('.').map(Number);
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
		return false;
	return (
		parts[0] === 10 ||
		parts[0] === 127 ||
		(parts[0] === 169 && parts[1] === 254) ||
		(parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) ||
		(parts[0] === 192 && parts[1] === 168)
	);
}

function validatedUrl(value: string, allowInsecureHttp = false, allowPrivateNetwork = false): URL {
	const url = new URL(value);
	if (url.username || url.password || url.hash)
		throw new Error('Notification URL must not contain credentials or a fragment.');
	if (url.protocol !== 'https:' && !(allowInsecureHttp && url.protocol === 'http:'))
		throw new Error('Notification URL must use HTTPS unless insecure HTTP is explicitly allowed.');
	if (privateHostname(url.hostname) && !allowPrivateNetwork)
		throw new Error('Private-network notification URLs require explicit permission.');
	return url;
}

export class NotificationService {
	readonly #crypto: () => CredentialEncryptionService;
	constructor(
		private readonly db: SqliteDatabase,
		crypto: CredentialEncryptionService | (() => CredentialEncryptionService) = () =>
			new CredentialEncryptionService(loadEncryptionKey(config.encryptionKeyFile)),
		private readonly fetcher: typeof fetch = fetch
	) {
		this.#crypto = typeof crypto === 'function' ? crypto : () => crypto;
	}

	list(ownerId: string): readonly SafeNotificationEndpoint[] {
		const rows = this.db
			.prepare(
				`SELECT n.*,
			 (SELECT COUNT(*) FROM notification_deliveries d WHERE d.endpoint_id=n.id AND d.state IN ('queued','delivering')) queued,
			 (SELECT COUNT(*) FROM notification_deliveries d WHERE d.endpoint_id=n.id AND d.state='failed') failed
			 FROM notification_endpoints n WHERE n.user_id=? ORDER BY n.name`
			)
			.all(ownerId) as Array<EndpointRow & { queued: number; failed: number }>;
		return rows.map((row) => {
			const encrypted = JSON.parse(row.encrypted_config) as EncryptedSecret;
			return {
				id: row.id,
				name: row.name,
				kind: row.kind,
				url: row.url,
				enabled: row.enabled === 1,
				eventFilters: JSON.parse(row.event_filters_json) as string[],
				configuredSecret: encrypted.ciphertext.length > 0,
				lastTestAt: row.last_test_at,
				lastTestStatus: row.last_test_status,
				safeErrorCode: row.safe_error_code,
				queued: row.queued,
				failed: row.failed
			};
		});
	}

	create(
		ownerId: string,
		input: {
			name: string;
			kind: NotificationKind;
			url: string;
			token?: string;
			secret?: string;
			allowInsecureHttp?: boolean;
			eventFilters?: readonly string[];
		}
	): string {
		if (!input.name.trim()) throw new Error('Notification name is required.');
		if (!['ntfy', 'apprise', 'gotify', 'webhook'].includes(input.kind))
			throw new Error('Unsupported notification adapter.');
		if (input.kind === 'gotify' && !input.token)
			throw new Error('Gotify requires an application token.');
		if (input.kind === 'webhook' && (!input.secret || input.secret.length < 16))
			throw new Error('Signed webhooks require a secret of at least 16 characters.');
		const url = validatedUrl(input.url, input.allowInsecureHttp, input.allowInsecureHttp);
		const id = randomUUID(),
			now = Date.now();
		const encrypted = this.#crypto().encrypt(
			JSON.stringify({
				...(input.token ? { token: input.token } : {}),
				...(input.secret ? { secret: input.secret } : {}),
				...(input.allowInsecureHttp ? { allowInsecureHttp: true } : {}),
				...(input.allowInsecureHttp ? { allowPrivateNetwork: true } : {})
			} satisfies NotificationConfig),
			ownerId,
			id
		);
		const filters = [
			...new Set(input.eventFilters?.length ? input.eventFilters : DEFAULT_EVENTS)
		].filter((value) => /^run\.[a-z-]+$/u.test(value));
		if (!filters.length) throw new Error('Select at least one notification event.');
		this.db
			.prepare(
				`INSERT INTO notification_endpoints
			 (id,user_id,name,kind,url,encrypted_config,event_filters_json,created_at,updated_at)
			 VALUES (?,?,?,?,?,?,?,?,?)`
			)
			.run(
				id,
				ownerId,
				input.name.trim(),
				input.kind,
				url.toString(),
				JSON.stringify(encrypted),
				JSON.stringify(filters),
				now,
				now
			);
		return id;
	}

	setEnabled(ownerId: string, id: string, enabled: boolean): boolean {
		return (
			this.db
				.prepare(
					'UPDATE notification_endpoints SET enabled=?,updated_at=? WHERE id=? AND user_id=?'
				)
				.run(enabled ? 1 : 0, Date.now(), id, ownerId).changes === 1
		);
	}

	delete(ownerId: string, id: string): boolean {
		return (
			this.db
				.prepare('DELETE FROM notification_endpoints WHERE id=? AND user_id=?')
				.run(id, ownerId).changes === 1
		);
	}

	async test(ownerId: string, id: string, signal: AbortSignal): Promise<void> {
		const row = this.#row(ownerId, id);
		if (!row) throw new Error('Notification endpoint not found.');
		try {
			await this.#deliver(
				row,
				{
					id: randomUUID(),
					type: 'run.test',
					resourceIds: [],
					payload: { message: 'GitTransit test notification' },
					createdAt: Date.now()
				},
				signal
			);
			this.db
				.prepare(
					"UPDATE notification_endpoints SET last_test_at=?,last_test_status='succeeded',safe_error_code=NULL,updated_at=? WHERE id=? AND user_id=?"
				)
				.run(Date.now(), Date.now(), id, ownerId);
		} catch (error) {
			this.db
				.prepare(
					"UPDATE notification_endpoints SET last_test_at=?,last_test_status='failed',safe_error_code='DELIVERY_FAILED',updated_at=? WHERE id=? AND user_id=?"
				)
				.run(Date.now(), Date.now(), id, ownerId);
			throw error;
		}
	}

	async dispatchNext(workerId: string, signal: AbortSignal): Promise<boolean> {
		const claim = transaction(this.db, () => {
			const now = Date.now();
			return this.db
				.prepare(
					`UPDATE notification_deliveries SET state='delivering',attempt=attempt+1,claimed_by=?,lease_expires_at=?,updated_at=? WHERE id=(SELECT id FROM notification_deliveries WHERE (state='queued' OR (state='delivering' AND lease_expires_at<?)) AND next_attempt_at<=? ORDER BY created_at LIMIT 1) RETURNING *`
				)
				.get(workerId, now + 30_000, now, now, now) as
				| {
						id: string;
						endpoint_id: string;
						user_id: string;
						event_type: string;
						payload_json: string;
						attempt: number;
				  }
				| undefined;
		});
		if (!claim) return false;
		const endpoint = this.#row(claim.user_id, claim.endpoint_id);
		if (!endpoint || !endpoint.enabled) {
			this.db
				.prepare(
					"UPDATE notification_deliveries SET state='failed',safe_error_code='ENDPOINT_DISABLED',updated_at=? WHERE id=?"
				)
				.run(Date.now(), claim.id);
			return true;
		}
		try {
			const snapshot = JSON.parse(claim.payload_json) as Omit<NotificationEvent, 'id'>;
			await this.#deliver(endpoint, { id: claim.id, ...snapshot }, signal);
			this.db
				.prepare(
					"UPDATE notification_deliveries SET state='delivered',delivered_at=?,claimed_by=NULL,lease_expires_at=NULL,safe_error_code=NULL,updated_at=? WHERE id=? AND claimed_by=?"
				)
				.run(Date.now(), Date.now(), claim.id, workerId);
		} catch (error) {
			const delivery =
				error instanceof NotificationDeliveryError
					? error
					: new NotificationDeliveryError(true, null, 'DELIVERY_FAILED');
			const retry = delivery.retryable && claim.attempt < 5;
			const next = delivery.retryAt ?? Date.now() + Math.min(300_000, 2 ** claim.attempt * 5_000);
			this.db
				.prepare(
					`UPDATE notification_deliveries SET state=?,next_attempt_at=?,claimed_by=NULL,lease_expires_at=NULL,safe_error_code=?,updated_at=? WHERE id=? AND claimed_by=?`
				)
				.run(retry ? 'queued' : 'failed', next, delivery.code, Date.now(), claim.id, workerId);
		}
		return true;
	}

	#row(ownerId: string, id: string): EndpointRow | null {
		return (
			(this.db
				.prepare('SELECT * FROM notification_endpoints WHERE id=? AND user_id=?')
				.get(id, ownerId) as EndpointRow | undefined) ?? null
		);
	}

	async #deliver(row: EndpointRow, event: NotificationEvent, signal: AbortSignal): Promise<void> {
		const configValue = this.#crypto().decrypt(
			JSON.parse(row.encrypted_config) as EncryptedSecret,
			row.user_id,
			row.id
		);
		const notificationConfig = JSON.parse(configValue) as NotificationConfig;
		const target: NotificationTarget = {
			kind: row.kind,
			url: validatedUrl(
				row.url,
				notificationConfig.allowInsecureHttp,
				notificationConfig.allowPrivateNetwork
			),
			config: notificationConfig
		};
		await notificationAdapters(this.fetcher)[row.kind].deliver(target, event, signal);
	}
}

let instance: NotificationService | undefined;
export function notificationService(): NotificationService {
	instance ??= new NotificationService(database());
	return instance;
}

export async function runNotificationDispatcher(
	service: NotificationService,
	workerId: string,
	signal: AbortSignal
): Promise<void> {
	while (!signal.aborted) {
		if (await service.dispatchNext(workerId, signal)) continue;
		await new Promise<void>((resolve) => {
			const timer = setTimeout(resolve, 1_000);
			signal.addEventListener(
				'abort',
				() => {
					clearTimeout(timer);
					resolve();
				},
				{ once: true }
			);
		});
	}
}
