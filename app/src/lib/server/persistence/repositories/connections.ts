import { randomUUID } from 'node:crypto';
import type { AdapterId } from '$lib/server/providers/types';
import type { EncryptedSecret } from '$lib/server/crypto/credentials';
import type { SqliteDatabase } from '../database';
import { transaction } from '../database';

export interface SafeConnection {
	id: string;
	name: string;
	providerId: AdapterId;
	baseUrl: string;
	enabled: boolean;
	credentialConfigured: boolean;
	credentialHint: string | null;
	product: string | null;
	productVersion: string | null;
	capabilities: readonly string[];
	lastTestAt: number | null;
	lastTestStatus: string | null;
	version: number;
}

export interface NewConnection {
	ownerId: string;
	name: string;
	providerId: AdapterId;
	baseUrl: string;
	credential?: {
		id: string;
		kind: 'token' | 'basic' | 'app-password' | 'ssh-key';
		encrypted: EncryptedSecret;
		hint: string;
	};
	probe: { product: string; version: string | null };
	capabilities: readonly string[];
}

interface ConnectionRow {
	id: string;
	name: string;
	provider_id: AdapterId;
	base_url: string;
	enabled: number;
	credential_id: string | null;
	display_hint: string | null;
	product: string | null;
	product_version: string | null;
	capabilities_json: string;
	last_test_at: number | null;
	last_test_status: string | null;
	version: number;
}

const selectSafe = `SELECT c.id, c.name, c.provider_id, c.base_url, c.enabled, c.credential_id,
 c.product, c.product_version, c.capabilities_json, c.last_test_at, c.last_test_status, c.version,
 cr.display_hint
 FROM connections c LEFT JOIN credentials cr ON cr.id = c.credential_id AND cr.user_id = c.user_id`;

function toSafe(row: ConnectionRow): SafeConnection {
	return {
		id: row.id,
		name: row.name,
		providerId: row.provider_id,
		baseUrl: row.base_url,
		enabled: row.enabled === 1,
		credentialConfigured: row.credential_id !== null,
		credentialHint: row.display_hint,
		product: row.product,
		productVersion: row.product_version,
		capabilities: JSON.parse(row.capabilities_json) as string[],
		lastTestAt: row.last_test_at,
		lastTestStatus: row.last_test_status,
		version: row.version
	};
}

export class ConnectionRepository {
	constructor(private readonly db: SqliteDatabase) {}

	list(ownerId: string): readonly SafeConnection[] {
		return (
			this.db
				.prepare(`${selectSafe} WHERE c.user_id = ? ORDER BY c.normalized_name`)
				.all(ownerId) as ConnectionRow[]
		).map(toSafe);
	}

	get(ownerId: string, id: string): SafeConnection | null {
		const row = this.db
			.prepare(`${selectSafe} WHERE c.user_id = ? AND c.id = ?`)
			.get(ownerId, id) as ConnectionRow | undefined;
		return row ? toSafe(row) : null;
	}

	create(input: NewConnection): SafeConnection {
		const id = randomUUID();
		const credentialId = input.credential?.id ?? null;
		const now = Date.now();
		transaction(this.db, () => {
			if (input.credential && credentialId) {
				this.db
					.prepare(
						`INSERT INTO credentials
				 (id,user_id,kind,encrypted_payload,key_version,display_hint,created_at,updated_at)
				 VALUES (?,?,?,?,?,?,?,?)`
					)
					.run(
						credentialId,
						input.ownerId,
						input.credential.kind,
						JSON.stringify(input.credential.encrypted),
						input.credential.encrypted.version,
						input.credential.hint,
						now,
						now
					);
			}
			this.db
				.prepare(
					`INSERT INTO connections
			 (id,user_id,name,normalized_name,provider_id,base_url,credential_id,product,product_version,
			 capabilities_json,capabilities_observed_at,last_test_at,last_test_status,created_at,updated_at)
			 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
				)
				.run(
					id,
					input.ownerId,
					input.name.trim(),
					input.name.trim().toLowerCase(),
					input.providerId,
					input.baseUrl,
					credentialId,
					input.probe.product,
					input.probe.version,
					JSON.stringify(input.capabilities),
					now,
					now,
					'ok',
					now,
					now
				);
		});
		const created = this.get(input.ownerId, id);
		if (!created) throw new Error('Created connection could not be loaded.');
		return created;
	}

	update(
		ownerId: string,
		id: string,
		version: number,
		fields: { name: string; baseUrl: string; enabled: boolean }
	): boolean {
		const result = this.db
			.prepare(
				`UPDATE connections SET name=?, normalized_name=?, base_url=?, enabled=?,
		 version=version+1, updated_at=? WHERE id=? AND user_id=? AND version=?`
			)
			.run(
				fields.name.trim(),
				fields.name.trim().toLowerCase(),
				fields.baseUrl,
				fields.enabled ? 1 : 0,
				Date.now(),
				id,
				ownerId,
				version
			);
		return result.changes === 1;
	}

	recordTest(
		ownerId: string,
		id: string,
		status: 'ok' | 'failed',
		safeErrorCode: string | null
	): boolean {
		return (
			this.db
				.prepare(
					`UPDATE connections SET last_test_at=?, last_test_status=?, safe_error_code=?,
		 updated_at=? WHERE id=? AND user_id=?`
				)
				.run(Date.now(), status, safeErrorCode, Date.now(), id, ownerId).changes === 1
		);
	}

	replaceCredential(
		ownerId: string,
		connectionId: string,
		credential: NonNullable<NewConnection['credential']>
	): boolean {
		return transaction(this.db, () => {
			const current = this.db
				.prepare('SELECT credential_id FROM connections WHERE id=? AND user_id=?')
				.get(connectionId, ownerId) as { credential_id: string | null } | undefined;
			if (!current) return false;
			const now = Date.now();
			this.db
				.prepare(
					`INSERT INTO credentials
			 (id,user_id,kind,encrypted_payload,key_version,display_hint,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`
				)
				.run(
					credential.id,
					ownerId,
					credential.kind,
					JSON.stringify(credential.encrypted),
					credential.encrypted.version,
					credential.hint,
					now,
					now
				);
			this.db
				.prepare(
					'UPDATE connections SET credential_id=?,version=version+1,updated_at=? WHERE id=? AND user_id=?'
				)
				.run(credential.id, now, connectionId, ownerId);
			if (current.credential_id)
				this.db
					.prepare('DELETE FROM credentials WHERE id=? AND user_id=?')
					.run(current.credential_id, ownerId);
			return true;
		});
	}

	readEncryptedCredential(
		ownerId: string,
		connectionId: string
	): { id: string; encrypted: EncryptedSecret } | null {
		const row = this.db
			.prepare(
				`SELECT cr.id, cr.encrypted_payload FROM connections c
		 JOIN credentials cr ON cr.id=c.credential_id AND cr.user_id=c.user_id
		 WHERE c.id=? AND c.user_id=?`
			)
			.get(connectionId, ownerId) as { id: string; encrypted_payload: string } | undefined;
		return row
			? { id: row.id, encrypted: JSON.parse(row.encrypted_payload) as EncryptedSecret }
			: null;
	}
}
