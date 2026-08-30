import type { GitEndpointSet, NormalizedRepository, RemoteRepositoryInput } from './types';

function safeUrl(value: string): URL {
	const url = new URL(value);
	if (url.password || (url.username && url.protocol !== 'ssh:'))
		throw new Error('Clone URLs must not contain embedded credentials.');
	if (!['http:', 'https:', 'ssh:'].includes(url.protocol))
		throw new Error('Clone URLs must use HTTP(S) or SSH.');
	return url;
}

export function normalizeRepository(input: RemoteRepositoryInput): NormalizedRepository {
	const displayPath = input.fullPath.trim().replace(/^\/+|\/+$/gu, '');
	if (!displayPath) throw new Error('Repository path is required.');
	return {
		externalId: input.externalId,
		displayPath,
		normalizedPath: displayPath.toLowerCase(),
		cloneUrl: safeUrl(input.cloneUrl),
		pushUrl: safeUrl(input.pushUrl ?? input.cloneUrl),
		webUrl: input.webUrl ? safeUrl(input.webUrl) : null,
		namespaceExternalId: input.namespaceExternalId ?? null,
		defaultBranch: input.defaultBranch ?? null,
		visibility: input.visibility ?? null,
		archived: input.archived ?? false,
		disabled: input.disabled ?? false,
		fork: input.fork ?? false,
		hasIssues: input.hasIssues ?? null,
		hasWiki: input.hasWiki ?? null,
		hasLfs: input.hasLfs ?? null,
		providerMetadata: input.providerMetadata ?? {}
	};
}

export function resolveEndpoints(repository: RemoteRepositoryInput): GitEndpointSet {
	const normalized = normalizeRepository(repository);
	const wiki = normalized.hasWiki
		? new URL(normalized.cloneUrl.toString().replace(/\.git$/u, '.wiki.git'))
		: null;
	return {
		fetchUrl: normalized.cloneUrl,
		pushUrl: normalized.pushUrl,
		lfsUrl: normalized.hasLfs ? normalized.cloneUrl : null,
		wikiFetchUrl: wiki,
		wikiPushUrl: wiki
	};
}
