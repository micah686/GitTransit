import type { CapabilitySet, ProviderId } from '../domain/types';

export type AdapterId = ProviderId | 'fake';

export interface AdapterContext {
	readonly connectionId: string;
	readonly signal: AbortSignal;
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

export interface RemoteRepositoryInput {
	readonly externalId: string | null;
	readonly fullPath: string;
	readonly cloneUrl: string;
}

export interface NormalizedRepository {
	readonly externalId: string | null;
	readonly displayPath: string;
	readonly normalizedPath: string;
	readonly cloneUrl: URL;
}

export interface InventoryAdapter {
	listRepositories(
		context: AdapterContext,
		cursor?: string
	): Promise<InventoryPage<RemoteRepositoryInput>>;
}

export interface RepositoryAdminAdapter {
	createEmpty(context: AdapterContext, path: string, idempotencyKey: string): Promise<unknown>;
}

export interface MetadataAdapter {
	readonly supportedComponents: ReadonlySet<string>;
}

export interface ProviderAdapter {
	readonly id: AdapterId;
	testConnection(context: AdapterContext): Promise<ConnectionProbe>;
	discoverCapabilities(context: AdapterContext): Promise<CapabilitySet>;
	readonly inventory?: InventoryAdapter;
	readonly repositories?: RepositoryAdminAdapter;
	readonly metadata?: MetadataAdapter;
	normalize(input: RemoteRepositoryInput): NormalizedRepository;
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
