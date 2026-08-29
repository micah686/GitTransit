import type { ContentPolicy, NamespaceMappingRule, NamespacePolicy } from './types';

const escapeRegex = (value: string): string => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');

export function globMatches(pattern: string, value: string): boolean {
	const expression = escapeRegex(pattern)
		.replaceAll('**', '\0')
		.replaceAll('*', '[^/]*')
		.replaceAll('\0', '.*');
	return new RegExp(`^${expression}$`, 'u').test(value);
}

export function selectNamespaceRule(
	sourceNamespace: string,
	policy: NamespacePolicy
): NamespaceMappingRule | undefined {
	return (
		policy.mappings.find((rule) => rule.match === 'exact' && rule.source === sourceNamespace) ??
		policy.mappings.find(
			(rule) => rule.match === 'glob' && globMatches(rule.source, sourceNamespace)
		)
	);
}

export function resolveTargetNamespace(
	sourceNamespace: string,
	policy: NamespacePolicy,
	routeOverride?: string
): string {
	if (routeOverride) return routeOverride;
	const rule = selectNamespaceRule(sourceNamespace, policy);
	if (rule) return rule.target;
	if (policy.strategy === 'preserve') return sourceNamespace;
	if (policy.defaultTarget) return policy.defaultTarget;
	throw new Error(`Namespace strategy ${policy.strategy} requires a target namespace.`);
}

export function inheritContentPolicy(
	pair: ContentPolicy,
	namespaceOverride?: Readonly<Partial<ContentPolicy>>,
	routeOverride?: Readonly<Partial<ContentPolicy>>
): ContentPolicy {
	return { ...pair, ...namespaceOverride, ...routeOverride };
}
