import { describe, expect, it } from 'vitest';
import { negotiateGitCapabilities, supportsLfs } from './capabilities';
import { globMatches, resolveTargetNamespace, selectNamespaceRule } from './mapping';
import { metadataExecutionOrder, validateMetadataPolicy } from './metadata-policy';
import type { Capability, MetadataPolicy, NamespacePolicy } from './types';

const capabilities = (...values: Capability[]): ReadonlySet<Capability> => new Set(values);

describe('domain contracts', () => {
	it('negotiates directional Git and LFS capabilities', () => {
		const a = capabilities('git:fetch', 'lfs:fetch');
		const b = capabilities('git:push', 'lfs:push');
		expect(negotiateGitCapabilities('one-way', a, b)).toEqual({ valid: true, missing: [] });
		expect(negotiateGitCapabilities('two-way', a, b)).toEqual({
			valid: false,
			missing: ['git:push', 'git:fetch']
		});
		expect(supportsLfs(a, b)).toBe(true);
	});

	it('applies route, exact, pattern, then default namespace precedence', () => {
		const policy: NamespacePolicy = {
			strategy: 'single-namespace',
			defaultTarget: 'fallback',
			mappings: [
				{ source: 'team/exact', target: 'exact-target', match: 'exact' },
				{ source: 'team/**', target: 'pattern-target', match: 'glob' }
			]
		};
		expect(resolveTargetNamespace('team/exact', policy, 'route-target')).toBe('route-target');
		expect(selectNamespaceRule('team/exact', policy)?.target).toBe('exact-target');
		expect(resolveTargetNamespace('team/subgroup', policy)).toBe('pattern-target');
		expect(resolveTargetNamespace('elsewhere', policy)).toBe('fallback');
		expect(globMatches('team/*', 'team/a/b')).toBe(false);
	});

	it('orders metadata dependencies and rejects implicit two-way authority', () => {
		const components: MetadataPolicy['components'] = {
			topics: 'on',
			labels: 'on',
			milestones: 'off',
			issues: 'required',
			'change-requests': 'off',
			releases: 'off',
			wiki: 'off'
		};
		const result = validateMetadataPolicy(
			'two-way',
			{ authority: null, components, changeRequests: 'archive-as-issue' },
			capabilities('topics:read', 'labels:read'),
			capabilities('topics:write', 'labels:write')
		);
		expect(metadataExecutionOrder.indexOf('labels')).toBeLessThan(
			metadataExecutionOrder.indexOf('issues')
		);
		expect(result.errors).toContain(
			'Two-way Git pairs require side A to be explicitly selected as metadata authority.'
		);
		expect(result.errors).toContain('issues is required but unsupported.');
	});
});
