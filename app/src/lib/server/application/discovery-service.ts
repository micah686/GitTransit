import { randomUUID } from 'node:crypto';
import { providerRegistry } from '../providers/registry';
import type {
	AdapterContext,
	NamespaceInput,
	ProviderAdapter,
	ProviderCredential,
	RemoteRepositoryInput
} from '../providers/types';
import type { ProviderRegistry } from '../providers/types';
import { ConnectionRepository } from '../persistence/repositories/connections';
import type { SqliteDatabase } from '../persistence/database';
import { database, transaction } from '../persistence/database';
import { CredentialEncryptionService, loadEncryptionKey } from '../crypto/credentials';
import { config } from '../config';
import { decodeCredentialEnvelope } from './connection-service';

export interface DiscoveredRepository {
	readonly id: string;
	readonly connectionId: string;
	readonly fullPath: string;
	readonly fetchUrl: string;
	readonly pushUrl: string;
	readonly visibility: string | null;
	readonly archived: boolean;
}

async function allPages<T>(
	load: (
		cursor?: string
	) => Promise<{ readonly items: readonly T[]; readonly nextCursor: string | null }>
): Promise<readonly T[]> {
	const items: T[] = [];
	const cursors = new Set<string>();
	let cursor: string | undefined;
	for (let page = 0; page < 10_000; page += 1) {
		const result = await load(cursor);
		items.push(...result.items);
		if (!result.nextCursor) return items;
		if (cursors.has(result.nextCursor))
			throw new Error('Provider returned a repeated pagination cursor.');
		cursors.add(result.nextCursor);
		cursor = result.nextCursor;
	}
	throw new Error('Provider pagination exceeded the safety limit.');
}

export class DiscoveryService {
	private readonly connections: ConnectionRepository;

	constructor(
		private readonly db: SqliteDatabase,
		private readonly encryption: () => CredentialEncryptionService,
		private readonly registry: ProviderRegistry = providerRegistry()
	) {
		this.connections = new ConnectionRepository(db);
	}

	list(actorId: string, connectionId?: string): readonly DiscoveredRepository[] {
		return this.db
			.prepare(
				`SELECT rr.id,rr.connection_id connectionId,rr.full_path fullPath,rr.fetch_url fetchUrl,
			 rr.push_url pushUrl,rr.visibility,rr.archived
			 FROM remote_repositories rr JOIN connections c ON c.id=rr.connection_id
			 WHERE c.user_id=? AND (? IS NULL OR c.id=?) ORDER BY rr.normalized_full_path`
			)
			.all(actorId, connectionId ?? null, connectionId ?? null) as DiscoveredRepository[];
	}

	async refresh(
		actorId: string,
		connectionId: string,
		externalSignal?: AbortSignal
	): Promise<{ namespaces: number; repositories: number }> {
		const connection = this.connections.get(actorId, connectionId);
		if (!connection || !connection.enabled) throw new Error('Connection is unavailable.');
		const adapter = this.registry.get(connection.providerId);
		if (
			!adapter.inventory ||
			connection.providerId === 'generic-git' ||
			connection.providerId === 'fake'
		)
			throw new Error('This provider does not expose named repository discovery.');
		const encrypted = this.connections.readEncryptedCredential(actorId, connectionId);
		let credential: ProviderCredential | undefined;
		if (encrypted) {
			if (encrypted.kind === 'ssh-key')
				throw new Error('API discovery requires an HTTP credential.');
			const plaintext = this.encryption().decrypt(encrypted.encrypted, actorId, encrypted.id);
			const envelope = decodeCredentialEnvelope(plaintext);
			credential = {
				kind: encrypted.kind,
				secret: envelope.secret,
				...(envelope.username ? { username: envelope.username } : {})
			};
		}
		const timeoutSignal = AbortSignal.timeout(120_000);
		const signal = externalSignal
			? AbortSignal.any([externalSignal, timeoutSignal])
			: timeoutSignal;
		{
			const context: AdapterContext = {
				connectionId,
				signal,
				baseUrl: new URL(connection.baseUrl),
				...(connection.apiUrl ? { apiUrl: new URL(connection.apiUrl) } : {}),
				...(credential ? { credential } : {})
			};
			const namespaces = adapter.inventory.listNamespaces
				? await allPages<NamespaceInput>((cursor) =>
						adapter.inventory!.listNamespaces!(context, cursor)
					)
				: [];
			const repositories = await allPages<RemoteRepositoryInput>((cursor) =>
				adapter.inventory!.listRepositories(context, cursor)
			);
			transaction(this.db, () => this.#persist(connectionId, namespaces, repositories, adapter));
			return { namespaces: namespaces.length, repositories: repositories.length };
		}
	}

	#persist(
		connectionId: string,
		namespaces: readonly NamespaceInput[],
		repositories: readonly RemoteRepositoryInput[],
		adapter: ProviderAdapter
	): void {
		const now = Date.now();
		this.db
			.prepare(
				"UPDATE remote_repositories SET discovery_state='not-observed' WHERE connection_id=? AND discovery_state='observed'"
			)
			.run(connectionId);
		const namespaceIds = new Map<string, string>();
		for (const namespace of namespaces) {
			const normalizedPath = namespace.fullPath.toLowerCase();
			const existing = this.db
				.prepare(
					`SELECT id FROM namespaces WHERE connection_id=? AND
				 (external_id=? OR normalized_path=?) ORDER BY external_id=? DESC LIMIT 1`
				)
				.get(connectionId, namespace.externalId, normalizedPath, namespace.externalId) as
				{ id: string } | undefined;
			const id = existing?.id ?? randomUUID();
			if (existing)
				this.db
					.prepare(
						`UPDATE namespaces SET external_id=?,full_path=?,normalized_path=?,kind=?,display_json=?,
						 observed_at=?,updated_at=? WHERE id=? AND connection_id=?`
					)
					.run(
						namespace.externalId,
						namespace.fullPath,
						normalizedPath,
						namespace.kind,
						JSON.stringify({ name: namespace.displayName }),
						now,
						now,
						id,
						connectionId
					);
			else
				this.db
					.prepare(
						`INSERT INTO namespaces
						 (id,connection_id,external_id,full_path,normalized_path,kind,display_json,observed_at,created_at,updated_at)
						 VALUES (?,?,?,?,?,?,?,?,?,?)`
					)
					.run(
						id,
						connectionId,
						namespace.externalId,
						namespace.fullPath,
						normalizedPath,
						namespace.kind,
						JSON.stringify({ name: namespace.displayName }),
						now,
						now,
						now
					);
			namespaceIds.set(namespace.externalId, id);
		}

		for (const input of repositories) {
			if (!input.externalId) throw new Error('Named provider repository lacks a stable identity.');
			const repository = adapter.normalize(input);
			const existing = this.db
				.prepare(
					`SELECT id FROM remote_repositories WHERE connection_id=? AND
					 (external_id=? OR normalized_full_path=?) ORDER BY external_id=? DESC LIMIT 1`
				)
				.get(connectionId, input.externalId, repository.normalizedPath, input.externalId) as
				{ id: string } | undefined;
			const values = [
				namespaceIds.get(repository.namespaceExternalId ?? '') ?? null,
				input.externalId,
				repository.displayPath.split('/').at(-1) ?? repository.displayPath,
				repository.displayPath,
				repository.normalizedPath,
				repository.webUrl?.toString() ?? null,
				repository.cloneUrl.toString(),
				repository.pushUrl.toString(),
				repository.defaultBranch,
				repository.visibility,
				repository.archived ? 1 : 0,
				repository.disabled ? 1 : 0,
				repository.fork ? 1 : 0,
				JSON.stringify({
					hasIssues: repository.hasIssues,
					hasWiki: repository.hasWiki,
					hasLfs: repository.hasLfs,
					provider: repository.providerMetadata
				}),
				now,
				now
			] as const;
			if (existing)
				this.db
					.prepare(
						`UPDATE remote_repositories SET namespace_id=?,external_id=?,name=?,full_path=?,
						 normalized_full_path=?,web_url=?,fetch_url=?,push_url=?,default_branch=?,visibility=?,
						 archived=?,disabled=?,fork=?,hints_json=?,discovery_state='observed',last_observed_at=?,updated_at=?
						 WHERE id=? AND connection_id=?`
					)
					.run(...values, existing.id, connectionId);
			else
				this.db
					.prepare(
						`INSERT INTO remote_repositories
						 (id,connection_id,namespace_id,external_id,name,full_path,normalized_full_path,web_url,
						 fetch_url,push_url,default_branch,visibility,archived,disabled,fork,hints_json,
						 discovery_state,last_observed_at,created_at,updated_at)
						 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'observed',?,?,?)`
					)
					.run(randomUUID(), connectionId, ...values, now);
		}
	}
}

let instance: DiscoveryService | undefined;
export function discoveryService(): DiscoveryService {
	instance ??= new DiscoveryService(
		database(),
		() => new CredentialEncryptionService(loadEncryptionKey(config.encryptionKeyFile))
	);
	return instance;
}
