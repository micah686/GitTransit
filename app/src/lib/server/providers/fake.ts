import type { Capability, CapabilitySet } from '$lib/server/domain/types';
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
	'git:push'
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
		createEmpty: async (_context: AdapterContext, path: string) => ({ id: `fake:${path}`, path })
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
			cloneUrl
		};
	}
}
