import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDatabase } from '$lib/server/persistence/database';
import { CredentialEncryptionService } from '$lib/server/crypto/credentials';
import { ConnectionRepository } from './connections';
import { ConnectionService } from '$lib/server/application/connection-service';

let db: SqliteDatabase | undefined;
afterEach(() => db?.close());

describe('ConnectionRepository', () => {
	it('scopes reads by owner and never returns encrypted credential material', async () => {
		db = openDatabase(':memory:');
		for (const [id, email] of [
			['owner-a', 'a@example.test'],
			['owner-b', 'b@example.test']
		]) {
			db.prepare(
				"INSERT INTO users (id,email,password_hash,role,created_at) VALUES (?,?,?,'member',0)"
			).run(id, email, 'hash');
		}
		const encryption = new CredentialEncryptionService(Buffer.alloc(32, 9));
		const repository = new ConnectionRepository(db);
		const service = new ConnectionService(repository, encryption);
		const created = await service.create('owner-a', {
			name: 'Development Forge',
			providerId: 'fake',
			baseUrl: 'https://forge.example.test',
			credential: 'a-secret-token'
		});
		expect(repository.get('owner-b', created.id)).toBeNull();
		expect(created).toMatchObject({ credentialConfigured: true, credentialHint: '••••oken' });
		expect(JSON.stringify(created)).not.toContain('a-secret-token');
		const stored = repository.readEncryptedCredential('owner-a', created.id);
		expect(stored).not.toBeNull();
		expect(encryption.decrypt(stored!.encrypted, 'owner-a', stored!.id)).toBe('a-secret-token');
		expect(repository.readEncryptedCredential('owner-b', created.id)).toBeNull();
	});
});
