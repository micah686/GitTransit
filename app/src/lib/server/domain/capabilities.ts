import type { Capability, CapabilitySet, Direction, MetadataComponent } from './types';

export interface PairCapabilityResult {
	readonly valid: boolean;
	readonly missing: readonly Capability[];
}

const metadataCapabilities: Readonly<
	Record<Exclude<MetadataComponent, 'wiki'>, readonly [Capability, Capability]>
> = {
	topics: ['topics:read', 'topics:write'],
	labels: ['labels:read', 'labels:write'],
	milestones: ['milestones:read', 'milestones:write'],
	issues: ['issues:read', 'issues:write'],
	'change-requests': ['change-requests:read', 'change-requests:write'],
	releases: ['releases:read', 'releases:write']
};

export function negotiateGitCapabilities(
	direction: Direction,
	a: CapabilitySet,
	b: CapabilitySet
): PairCapabilityResult {
	const requirements: readonly [CapabilitySet, Capability][] =
		direction === 'one-way'
			? [
					[a, 'git:fetch'],
					[b, 'git:push']
				]
			: [
					[a, 'git:fetch'],
					[a, 'git:push'],
					[b, 'git:fetch'],
					[b, 'git:push']
				];
	const missing = requirements
		.filter(([set, capability]) => !set.has(capability))
		.map(([, c]) => c);
	return { valid: missing.length === 0, missing };
}

export function supportsMetadata(
	component: MetadataComponent,
	a: CapabilitySet,
	b: CapabilitySet
): boolean {
	if (component === 'wiki') return a.has('wiki:fetch') && b.has('wiki:push');
	const [read, write] = metadataCapabilities[component];
	return a.has(read) && b.has(write);
}

export function supportsLfs(a: CapabilitySet, b: CapabilitySet): boolean {
	return a.has('lfs:fetch') && b.has('lfs:push');
}
