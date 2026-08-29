import { supportsMetadata } from './capabilities';
import type { CapabilitySet, Direction, MetadataComponent, MetadataPolicy } from './types';

export const metadataExecutionOrder: readonly MetadataComponent[] = [
	'topics',
	'labels',
	'milestones',
	'issues',
	'change-requests',
	'releases',
	'wiki'
];

export interface MetadataValidation {
	readonly errors: readonly string[];
	readonly warnings: readonly string[];
	readonly enabled: readonly MetadataComponent[];
}

export function validateMetadataPolicy(
	direction: Direction,
	policy: MetadataPolicy,
	a: CapabilitySet,
	b: CapabilitySet
): MetadataValidation {
	const errors: string[] = [];
	const warnings: string[] = [];
	const enabled: MetadataComponent[] = [];
	const configured = metadataExecutionOrder.filter(
		(component) => policy.components[component] !== 'off'
	);
	if (direction === 'two-way' && configured.length > 0 && policy.authority !== 'A') {
		errors.push(
			'Two-way Git pairs require side A to be explicitly selected as metadata authority.'
		);
	}
	for (const component of configured) {
		if (supportsMetadata(component, a, b)) enabled.push(component);
		else if (policy.components[component] === 'required')
			errors.push(`${component} is required but unsupported.`);
		else warnings.push(`${component} is unsupported and will be skipped.`);
	}
	return { errors, warnings, enabled };
}
