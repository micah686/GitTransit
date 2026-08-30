import type { Capability, CapabilitySet } from '$lib/server/domain/types';
import type {
	AdapterContext,
	ConnectionProbe,
	NormalizedRepository,
	ProviderAdapter,
	RemoteRepositoryInput
} from './types';

const capabilities: CapabilitySet = new Set<Capability>([
	'repository:read',
	'git:fetch',
	'git:push'
]);

export class GenericGitProviderAdapter implements ProviderAdapter {
	readonly id = 'generic-git' as const;

	async testConnection(context: AdapterContext): Promise<ConnectionProbe> {
		if (context.signal.aborted) throw context.signal.reason;
		return { product: 'Generic Git', version: null, authenticatedIdentity: 'manual endpoint' };
	}

	async discoverCapabilities(): Promise<CapabilitySet> {
		return capabilities;
	}

	normalize(input: RemoteRepositoryInput): NormalizedRepository {
		const cloneUrl = new URL(input.cloneUrl);
		if (cloneUrl.username || cloneUrl.password)
			throw new Error('Clone URLs must not contain embedded credentials.');
		if (!['https:', 'http:', 'ssh:'].includes(cloneUrl.protocol)) {
			throw new Error('Generic Git endpoints must use HTTP(S) or SSH.');
		}
		const displayPath = input.fullPath.trim().replace(/^\/+|\/+$/g, '');
		if (!displayPath) throw new Error('Repository path is required.');
		return {
			externalId: input.externalId,
			displayPath,
			normalizedPath: displayPath.toLowerCase(),
			cloneUrl
		};
	}
}
