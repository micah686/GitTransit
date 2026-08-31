import type { Capability, CapabilitySet } from '$lib/server/domain/types';
import { createHash } from 'node:crypto';
import type { MetadataComponent } from '$lib/server/domain/types';
import type { NormalizedMetadataRecord } from '$lib/server/domain/metadata-contracts';
import type {
	AdapterContext,
	ConnectionProbe,
	InventoryPage,
	NormalizedRepository,
	ProviderAdapter,
	RemoteRepositoryInput
} from './types';

const capabilities: CapabilitySet = new Set<Capability>([
	'identity:read',
	'namespace:list',
	'repository:list',
	'repository:read',
	'repository:create',
	'git:fetch',
	'git:push',
	'topics:read',
	'topics:write',
	'labels:read',
	'labels:write',
	'milestones:read',
	'milestones:write',
	'issues:read',
	'issues:write',
	'change-requests:read',
	'change-requests:write',
	'releases:read',
	'releases:write'
]);

export class FakeProviderAdapter implements ProviderAdapter {
	readonly id = 'fake' as const;
	readonly inventory = {
		listRepositories: async (
			_context: AdapterContext,
			cursor?: string
		): Promise<InventoryPage<RemoteRepositoryInput>> => ({
			items: cursor
				? []
				: [
						{
							externalId: 'fake-1',
							fullPath: 'example/alpha',
							cloneUrl: 'https://fake.invalid/example/alpha.git'
						}
					],
			nextCursor: null
		})
	};
	readonly repositories = {
		find: async (_context: AdapterContext, path: string) => ({
			externalId: `fake:${path}`,
			fullPath: path,
			cloneUrl: `https://fake.invalid/${path}.git`
		}),
		createEmpty: async (_context: AdapterContext, path: string) => ({
			externalId: `fake:${path}`,
			fullPath: path,
			cloneUrl: `https://fake.invalid/${path}.git`
		})
	};
	readonly #metadataWrites = new Map<string, NormalizedMetadataRecord>();
	readonly metadata = {
		supportedComponents: new Set<MetadataComponent>([
			'topics',
			'labels',
			'milestones',
			'issues',
			'change-requests',
			'releases'
		]),
		list: async (
			context: AdapterContext,
			repository: string,
			component: MetadataComponent,
			cursor?: string
		) => {
			if (context.signal.aborted) throw context.signal.reason;
			if (cursor) return { items: [], nextCursor: null };
			const externalId = `${repository}:${component}:1`;
			const content = JSON.stringify({ component, repository, title: `Example ${component}` });
			return {
				items: [
					{
						identity: {
							provider: this.id,
							connectionId: context.connectionId,
							repositoryId: repository,
							component,
							externalId
						},
						kind: component,
						title: `Example ${component}`,
						body: null,
						state: 'open',
						sourceUrl: new URL(`https://fake.invalid/${repository}/${component}/1`),
						sourceAuthorDisplay: 'Fake User',
						sourceCreatedAt: '2026-01-01T00:00:00.000Z',
						sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
						fields: component === 'releases' ? { tag: 'v1.0.0', assets: [] } : {},
						contentDigest: createHash('sha256').update(content).digest('hex')
					}
				],
				nextCursor: null
			};
		},
		previewLoss: () => ({ unsupportedFields: [], lossyFields: [], warnings: [] }),
		upsert: async (
			context: AdapterContext,
			repository: string,
			record: NormalizedMetadataRecord,
			provenance: string,
			targetExternalId: string | null
		) => {
			if (context.signal.aborted) throw context.signal.reason;
			const id = targetExternalId ?? provenance;
			this.#metadataWrites.set(id, record);
			return {
				targetExternalId: id,
				targetUrl: new URL(
					`https://fake.invalid/${repository}/${record.kind}/${encodeURIComponent(id)}`
				),
				loss: { unsupportedFields: [], lossyFields: [], warnings: [] }
			};
		}
	};

	async testConnection(context: AdapterContext): Promise<ConnectionProbe> {
		if (context.signal.aborted) throw context.signal.reason;
		return { product: 'GitTransit Fake Forge', version: '1', authenticatedIdentity: 'phase2-user' };
	}

	async discoverCapabilities(): Promise<CapabilitySet> {
		return capabilities;
	}

	normalize(input: RemoteRepositoryInput): NormalizedRepository {
		const displayPath = input.fullPath.trim().replace(/^\/+|\/+$/g, '');
		const cloneUrl = new URL(input.cloneUrl);
		if (cloneUrl.password || (cloneUrl.username && cloneUrl.protocol !== 'ssh:'))
			throw new Error('Clone URLs must not contain embedded credentials.');
		return {
			externalId: input.externalId,
			displayPath,
			normalizedPath: displayPath.toLowerCase(),
			cloneUrl,
			pushUrl: new URL(input.pushUrl ?? input.cloneUrl),
			webUrl: input.webUrl ? new URL(input.webUrl) : null,
			namespaceExternalId: input.namespaceExternalId ?? null,
			defaultBranch: input.defaultBranch ?? null,
			visibility: input.visibility ?? null,
			archived: input.archived ?? false,
			disabled: input.disabled ?? false,
			fork: input.fork ?? false,
			hasIssues: input.hasIssues ?? null,
			hasWiki: input.hasWiki ?? null,
			hasLfs: input.hasLfs ?? null,
			providerMetadata: input.providerMetadata ?? {}
		};
	}
}
