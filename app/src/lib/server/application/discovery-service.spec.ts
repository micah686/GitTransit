import { afterEach, describe, expect, it } from 'vitest';
import { CredentialEncryptionService } from '../crypto/credentials';
import { openDatabase, type SqliteDatabase } from '../persistence/database';
import { ConnectionRepository } from '../persistence/repositories/connections';
import { normalizeRepository } from '../providers/normalize';
import { ProviderRegistry, type ProviderAdapter } from '../providers/types';
import { DiscoveryService } from './discovery-service';

let db: SqliteDatabase | undefined;
afterEach(() => db?.close());

describe('named provider discovery', () => {
	it('fully paginates before owner-scoped stable-identity upserts', async () => {
		db = openDatabase(':memory:');
		db.prepare(
			"INSERT INTO users(id,email,password_hash,role,created_at) VALUES ('owner-a','a@x.test','x','member',0),('owner-b','b@x.test','x','member',0)"
		).run();
		const encryption = new CredentialEncryptionService(Buffer.alloc(32, 5));
		const credentialId = 'credential-1';
		const repository = new ConnectionRepository(db);
		const connection = repository.create({
			ownerId: 'owner-a',
			name: 'Gitea',
			providerId: 'gitea',
			baseUrl: 'https://gitea.test/',
			credential: {
				id: credentialId,
				kind: 'token',
				encrypted: encryption.encrypt('secret-token', 'owner-a', credentialId),
				hint: '••••oken'
			},
			probe: { product: 'Gitea', version: '1.24' },
			capabilities: ['repository:list']
		});
		const adapter: ProviderAdapter = {
			id: 'gitea',
			testConnection: async () => ({
				product: 'Gitea',
				version: '1.24',
				authenticatedIdentity: 'me'
			}),
			discoverCapabilities: async () => new Set(),
			inventory: {
				listNamespaces: async (_context, cursor) => ({
					items: cursor
						? []
						: [
								{
									externalId: 'namespace-1',
									fullPath: 'Team/Sub',
									kind: 'subgroup',
									displayName: 'Sub'
								}
							],
					nextCursor: cursor ? null : '2'
				}),
				listRepositories: async (_context, cursor) => ({
					items: [
						{
							externalId: cursor ? 'repo-2' : 'repo-1',
							fullPath: cursor ? 'Team/Sub/Second' : 'Team/Sub/First',
							cloneUrl: `https://gitea.test/Team/Sub/${cursor ? 'Second' : 'First'}.git`,
							namespaceExternalId: 'namespace-1'
						}
					],
					nextCursor: cursor ? null : '2'
				})
			},
			normalize: normalizeRepository
		};
		const registry = new ProviderRegistry();
		registry.register(adapter);
		const service = new DiscoveryService(db, () => encryption, registry);
		expect(await service.refresh('owner-a', connection.id)).toEqual({
			namespaces: 1,
			repositories: 2
		});
		expect(service.list('owner-a', connection.id).map((item) => item.fullPath)).toEqual([
			'Team/Sub/First',
			'Team/Sub/Second'
		]);
		expect(service.list('owner-b', connection.id)).toEqual([]);
		await service.refresh('owner-a', connection.id);
		expect(service.list('owner-a', connection.id)).toHaveLength(2);
	});
});
