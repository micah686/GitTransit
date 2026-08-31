import { describe, expect, it } from 'vitest';
import { providerRegistry } from './registry';
import type { AdapterId } from './types';

const enabled = process.env.GITTRANSIT_PROVIDER_SMOKE === '1';

describe.runIf(enabled)('opt-in real provider smoke', () => {
	it('probes identity, capabilities, and one inventory page without mutation', async () => {
		const provider = String(process.env.GITTRANSIT_SMOKE_PROVIDER ?? '') as AdapterId;
		if (!['github', 'gitlab', 'bitbucket-cloud', 'gitea', 'forgejo'].includes(provider))
			throw new Error('GITTRANSIT_SMOKE_PROVIDER must name a supported API provider.');
		const adapter = providerRegistry().get(provider);
		const baseUrl = new URL(String(process.env.GITTRANSIT_SMOKE_BASE_URL ?? ''));
		const apiValue = process.env.GITTRANSIT_SMOKE_API_URL;
		const token = process.env.GITTRANSIT_SMOKE_TOKEN;
		if (!token) throw new Error('GITTRANSIT_SMOKE_TOKEN is required.');
		const context = {
			connectionId: 'opt-in-smoke',
			signal: AbortSignal.timeout(30_000),
			baseUrl,
			...(apiValue ? { apiUrl: new URL(apiValue) } : {}),
			credential: { kind: 'token' as const, secret: token }
		};
		const probe = await adapter.testConnection(context);
		const capabilities = await adapter.discoverCapabilities(context);
		expect(probe.authenticatedIdentity).toBeTruthy();
		expect(capabilities.has('identity:read')).toBe(true);
		if (adapter.inventory) {
			const page = await adapter.inventory.listRepositories(context);
			expect(Array.isArray(page.items)).toBe(true);
		}
	});
});
