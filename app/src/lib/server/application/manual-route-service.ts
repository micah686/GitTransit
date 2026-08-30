import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config';
import type { AuthenticatedEndpoint } from '../git/types';
import { ControlledGitTransport } from '../git/transport';
import { planOneWayRefs } from '../domain/ref-plan';
import { entityId, type RefAction, type RefMap, type TargetOnlyRefPolicy } from '../domain/types';
import { ConnectionRepository, type SafeConnection } from '../persistence/repositories/connections';
import { ManualRouteRepository } from '../persistence/repositories/manual-routes';
import { database } from '../persistence/database';
import { CredentialEncryptionService, loadEncryptionKey } from '../crypto/credentials';
import { decodeCredentialEnvelope } from './connection-service';

export interface ManualRouteValues {
	name: string;
	connectionAId: string;
	connectionBId: string;
	sourceUrl: string;
	targetUrl: string;
	targetOnly: TargetOnlyRefPolicy;
	safety: 'fast-forward-only' | 'backup-and-apply' | 'approve-destructive' | 'never-delete';
	lfs: 'off' | 'auto' | 'on';
	wiki: boolean;
}

export interface ManualPreview {
	sourceRefs: number;
	targetRefs: number;
	actions: readonly RefAction[];
	warnings: readonly string[];
}

function parseEndpoint(value: string): URL {
	const url = new URL(value);
	if (
		!['https:', 'http:', 'ssh:'].includes(url.protocol) ||
		url.password ||
		(url.username && url.protocol !== 'ssh:')
	)
		throw new Error(
			'Repository URLs must use HTTP(S) or ssh:// and contain no embedded credentials.'
		);
	return url;
}

function displayPath(url: URL): string {
	const value = url.pathname.replace(/^\/+|\/+$/gu, '').replace(/\.git$/u, '');
	if (!value) throw new Error('Repository URL must include a repository path.');
	return value;
}

export class ManualRouteService {
	constructor(
		private readonly connections: ConnectionRepository,
		private readonly routes: ManualRouteRepository,
		private readonly transport: ControlledGitTransport,
		private readonly encryption: () => CredentialEncryptionService
	) {}

	listConnections(actorId: string): readonly SafeConnection[] {
		return this.connections
			.list(actorId)
			.filter((connection) => connection.enabled && connection.providerId === 'generic-git');
	}

	list(actorId: string) {
		return this.routes.list(actorId);
	}

	#endpoint(actorId: string, connection: SafeConnection, url: URL): AuthenticatedEndpoint {
		const encrypted = this.connections.readEncryptedCredential(actorId, connection.id);
		const decrypted = encrypted
			? decodeCredentialEnvelope(
					this.encryption().decrypt(encrypted.encrypted, actorId, encrypted.id)
				)
			: null;
		const credential =
			encrypted && decrypted && ['http:', 'https:'].includes(url.protocol)
				? {
						kind: 'https' as const,
						username: decrypted.username ?? 'git',
						password: decrypted.secret
					}
				: undefined;
		return {
			url,
			credentialId: encrypted?.id ?? null,
			stableIdentity: url.toString(),
			...(credential ? { credential } : {})
		};
	}

	async preview(actorId: string, values: ManualRouteValues): Promise<ManualPreview> {
		if (!values.name.trim() || values.connectionAId === values.connectionBId)
			throw new Error('A name and two different connections are required.');
		const available = this.listConnections(actorId);
		const aConnection = available.find((item) => item.id === values.connectionAId);
		const bConnection = available.find((item) => item.id === values.connectionBId);
		if (!aConnection || !bConnection) throw new Error('A selected connection is unavailable.');
		const sourceUrl = parseEndpoint(values.sourceUrl);
		const targetUrl = parseEndpoint(values.targetUrl);
		const endpoints = {
			A: this.#endpoint(actorId, aConnection, sourceUrl),
			B: this.#endpoint(actorId, bConnection, targetUrl)
		} as const;
		const workspace = await this.transport.prepareWorkspace(
			entityId(`preview-${randomUUID()}`),
			`preview-${randomUUID()}`,
			endpoints
		);
		let a: RefMap;
		let b: RefMap;
		let actions: readonly RefAction[];
		try {
			a = await this.transport.fetch(workspace, 'A', ['refs/heads/*', 'refs/tags/*']);
			b = await this.transport.fetch(workspace, 'B', ['refs/heads/*', 'refs/tags/*']);
			actions = await planOneWayRefs(a, b, values.targetOnly, (older, newer) =>
				this.transport.isAncestor(workspace, older, newer)
			);
		} finally {
			await this.transport.disposeWorkspace(workspace);
		}
		const warnings: string[] = [];
		if (!b.size)
			warnings.push('The target is empty; GitTransit will create refs, not the repository itself.');
		if (values.lfs === 'on' && !(await this.transport.isLfsAvailable()))
			throw new Error('Git LFS is required but git-lfs is not installed.');
		if (values.lfs === 'auto' && !(await this.transport.isLfsAvailable()))
			warnings.push('Git LFS is unavailable; Git refs can still be synchronized.');
		if (values.wiki)
			warnings.push(
				'Wiki sync uses a separately mapped linked route and is not inferred from this URL.'
			);
		return {
			sourceRefs: a.size,
			targetRefs: b.size,
			actions,
			warnings
		};
	}

	async create(actorId: string, values: ManualRouteValues) {
		await this.preview(actorId, values);
		const sourceUrl = parseEndpoint(values.sourceUrl);
		const targetUrl = parseEndpoint(values.targetUrl);
		return this.routes.create({
			ownerId: actorId,
			name: values.name,
			connectionAId: values.connectionAId,
			connectionBId: values.connectionBId,
			sourceUrl: sourceUrl.toString(),
			targetUrl: targetUrl.toString(),
			sourcePath: displayPath(sourceUrl),
			targetPath: displayPath(targetUrl),
			content: {
				refs: {
					includes: ['refs/heads/*', 'refs/tags/*'],
					excludes: [],
					targetOnly: values.targetOnly
				},
				lfs: values.lfs,
				wiki: values.wiki ? 'on' : 'off'
			},
			safety: { strategy: values.safety, requireBackup: values.safety === 'backup-and-apply' }
		});
	}
}

let instance: ManualRouteService | undefined;
export function manualRouteService(): ManualRouteService {
	const db = database();
	instance ??= new ManualRouteService(
		new ConnectionRepository(db),
		new ManualRouteRepository(db),
		new ControlledGitTransport({
			workspaceRoot: path.join(config.dataDir, 'work'),
			artifactRoot: path.join(config.dataDir, 'backups')
		}),
		() => new CredentialEncryptionService(loadEncryptionKey(config.encryptionKeyFile))
	);
	return instance;
}
