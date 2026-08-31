import type { CapabilitySet, MetadataComponent, ProviderId } from '../domain/types';
import type {
	MetadataLossReport,
	MetadataWriteResult,
	NormalizedMetadataRecord,
	RateLimitObservation
} from '../domain/metadata-contracts';

export type AdapterId = ProviderId | 'fake';

export interface AdapterContext {
	readonly connectionId: string;
	readonly signal: AbortSignal;
	readonly baseUrl?: URL;
	readonly apiUrl?: URL;
	readonly credential?: ProviderCredential;
}

export interface ProviderCredential {
	readonly kind: 'token' | 'basic' | 'app-password';
	readonly secret: string;
	readonly username?: string;
}

export interface ConnectionProbe {
	readonly product: string;
	readonly version: string | null;
	readonly authenticatedIdentity: string;
}

export interface InventoryPage<T> {
	readonly items: readonly T[];
	readonly nextCursor: string | null;
}

export interface NamespaceInput {
	readonly externalId: string;
	readonly fullPath: string;
	readonly kind: 'user' | 'organization' | 'group' | 'subgroup' | 'workspace' | 'project';
	readonly displayName: string;
}

export interface RemoteRepositoryInput {
	readonly externalId: string | null;
	readonly fullPath: string;
	readonly cloneUrl: string;
	readonly pushUrl?: string;
	readonly webUrl?: string;
	readonly namespaceExternalId?: string;
	readonly defaultBranch?: string | null;
	readonly visibility?: string;
	readonly archived?: boolean;
	readonly disabled?: boolean;
	readonly fork?: boolean;
	readonly hasIssues?: boolean;
	readonly hasWiki?: boolean;
	readonly hasLfs?: boolean;
	readonly providerMetadata?: Readonly<Record<string, unknown>>;
}

export interface NormalizedRepository {
	readonly externalId: string | null;
	readonly displayPath: string;
	readonly normalizedPath: string;
	readonly cloneUrl: URL;
	readonly pushUrl: URL;
	readonly webUrl: URL | null;
	readonly namespaceExternalId: string | null;
	readonly defaultBranch: string | null;
	readonly visibility: string | null;
	readonly archived: boolean;
	readonly disabled: boolean;
	readonly fork: boolean;
	readonly hasIssues: boolean | null;
	readonly hasWiki: boolean | null;
	readonly hasLfs: boolean | null;
	readonly providerMetadata: Readonly<Record<string, unknown>>;
}

export interface InventoryAdapter {
	listNamespaces?(context: AdapterContext, cursor?: string): Promise<InventoryPage<NamespaceInput>>;
	listRepositories(
		context: AdapterContext,
		cursor?: string,
		namespace?: NamespaceInput
	): Promise<InventoryPage<RemoteRepositoryInput>>;
}

export interface RepositoryAdminAdapter {
	find(context: AdapterContext, pathOrId: string): Promise<RemoteRepositoryInput | null>;
	createEmpty(
		context: AdapterContext,
		path: string,
		idempotencyKey: string
	): Promise<RemoteRepositoryInput>;
}

export interface GitEndpointSet {
	readonly fetchUrl: URL;
	readonly pushUrl: URL;
	readonly lfsUrl: URL | null;
	readonly wikiFetchUrl: URL | null;
	readonly wikiPushUrl: URL | null;
}

export interface MetadataAdapter {
	readonly supportedComponents: ReadonlySet<string>;
	list?(
		context: AdapterContext,
		repository: string,
		component: MetadataComponent,
		cursor?: string
	): Promise<{
		readonly items: readonly NormalizedMetadataRecord[];
		readonly nextCursor: string | null;
		readonly rateLimit?: RateLimitObservation;
	}>;
	previewLoss?(component: MetadataComponent, record: NormalizedMetadataRecord): MetadataLossReport;
	upsert?(
		context: AdapterContext,
		repository: string,
		record: NormalizedMetadataRecord,
		provenance: string,
		targetExternalId: string | null
	): Promise<MetadataWriteResult & { readonly rateLimit?: RateLimitObservation }>;
}

export interface ProviderAdapter {
	readonly id: AdapterId;
	testConnection(context: AdapterContext): Promise<ConnectionProbe>;
	discoverCapabilities(context: AdapterContext): Promise<CapabilitySet>;
	readonly inventory?: InventoryAdapter;
	readonly repositories?: RepositoryAdminAdapter;
	readonly metadata?: MetadataAdapter;
	normalize(input: RemoteRepositoryInput): NormalizedRepository;
	resolveGitEndpoints?(repository: RemoteRepositoryInput): GitEndpointSet;
}

export type ProviderErrorKind =
	'unauthorized' | 'forbidden' | 'not-found' | 'rate-limited' | 'invalid' | 'server' | 'network';

export class ProviderOperationError extends Error {
	constructor(
		readonly kind: ProviderErrorKind,
		readonly status: number | null,
		readonly retryAt: number | null = null
	) {
		super(`Provider operation failed: ${kind}.`);
		this.name = 'ProviderOperationError';
	}
}

export class ProviderRegistry {
	readonly #adapters = new Map<AdapterId, ProviderAdapter>();

	register(adapter: ProviderAdapter): void {
		if (this.#adapters.has(adapter.id))
			throw new Error(`Duplicate provider adapter: ${adapter.id}`);
		this.#adapters.set(adapter.id, adapter);
	}

	get(id: AdapterId): ProviderAdapter {
		const adapter = this.#adapters.get(id);
		if (!adapter) throw new Error(`Provider adapter is not registered: ${id}`);
		return adapter;
	}

	list(): readonly ProviderAdapter[] {
		return [...this.#adapters.values()];
	}
}
