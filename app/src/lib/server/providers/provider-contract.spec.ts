import { describe, expect, it } from 'vitest';
import { FakeProviderAdapter } from './fake';
import { GenericGitProviderAdapter } from './generic-git';
import type { ProviderAdapter } from './types';

const adapters: readonly ProviderAdapter[] = [
	new FakeProviderAdapter(),
	new GenericGitProviderAdapter()
];

describe.each(adapters)('$id provider contract', (adapter) => {
	it('probes identity and exposes Git capabilities', async () => {
		const context = { connectionId: 'connection-1', signal: new AbortController().signal };
		const probe = await adapter.testConnection(context);
		const capabilities = await adapter.discoverCapabilities(context);
		expect(probe.product.length).toBeGreaterThan(0);
		expect(capabilities.has('git:fetch')).toBe(true);
		expect(capabilities.has('git:push')).toBe(true);
	});

	it('normalizes repository identity with a credential-free endpoint', () => {
		const normalized = adapter.normalize({
			externalId: '1',
			fullPath: '/Team/Repo/',
			cloneUrl: 'https://example.test/Team/Repo.git'
		});
		expect(normalized.normalizedPath).toBe('team/repo');
		expect(normalized.cloneUrl.username).toBe('');
	});

	it('rejects authenticated clone URLs before they can be persisted', () => {
		expect(() =>
			adapter.normalize({
				externalId: '1',
				fullPath: 'team/repo',
				cloneUrl: 'https://user:secret@example.test/repo.git'
			})
		).toThrow('must not contain embedded credentials');
	});

	it('permits the non-secret user component of an SSH URL', () => {
		const normalized = adapter.normalize({
			externalId: 'ssh-1',
			fullPath: 'team/repo',
			cloneUrl: 'ssh://git@example.test/team/repo.git'
		});
		expect(normalized.cloneUrl.username).toBe('git');
	});
});
