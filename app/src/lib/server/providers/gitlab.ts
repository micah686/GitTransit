import type { Capability, CapabilitySet } from '../domain/types';
import { ProviderHttpClient, apiBase, pageCursor } from './http';
import { normalizeRepository, resolveEndpoints } from './normalize';
import type {
	AdapterContext,
	ConnectionProbe,
	InventoryPage,
	NamespaceInput,
	ProviderAdapter,
	RemoteRepositoryInput
} from './types';

interface GitLabUser {
	id: number;
	username: string;
	name: string;
}
interface GitLabVersion {
	version: string;
}
interface GitLabNamespace {
	id: number;
	name: string;
	path: string;
	full_path?: string;
	kind: 'user' | 'group';
	parent_id?: number | null;
}
interface GitLabProject {
	id: number;
	name: string;
	path_with_namespace: string;
	http_url_to_repo: string;
	web_url: string;
	default_branch?: string | null;
	visibility: string;
	archived: boolean;
	empty_repo?: boolean;
	issues_enabled?: boolean;
	wiki_enabled?: boolean;
	forked_from_project?: unknown;
	namespace: { id: number; full_path?: string; path: string };
	permissions?: {
		project_access?: { access_level: number } | null;
		group_access?: { access_level: number } | null;
	};
}

const read: readonly Capability[] = [
	'identity:read',
	'namespace:list',
	'repository:list',
	'repository:read',
	'git:fetch',
	'topics:read',
	'labels:read',
	'milestones:read',
	'issues:read',
	'change-requests:read',
	'releases:read',
	'wiki:fetch',
	'lfs:fetch'
];
const write: readonly Capability[] = [
	'repository:create',
	'repository:update',
	'git:push',
	'git:delete-ref',
	'topics:write',
	'labels:write',
	'milestones:write',
	'issues:write',
	'change-requests:write',
	'releases:write',
	'wiki:push',
	'lfs:push'
];

function project(input: GitLabProject): RemoteRepositoryInput {
	return {
		externalId: String(input.id),
		fullPath: input.path_with_namespace,
		cloneUrl: input.http_url_to_repo,
		pushUrl: input.http_url_to_repo,
		webUrl: input.web_url,
		namespaceExternalId: String(input.namespace.id),
		defaultBranch: input.default_branch ?? null,
		visibility: input.visibility,
		archived: input.archived,
		disabled: false,
		fork: Boolean(input.forked_from_project),
		...(input.issues_enabled === undefined ? {} : { hasIssues: input.issues_enabled }),
		...(input.wiki_enabled === undefined ? {} : { hasWiki: input.wiki_enabled }),
		hasLfs: true
	};
}

export class GitLabProviderAdapter implements ProviderAdapter {
	readonly id = 'gitlab' as const;
	readonly inventory = {
		listNamespaces: (context: AdapterContext, cursor?: string) =>
			this.listNamespaces(context, cursor),
		listRepositories: (context: AdapterContext, cursor?: string) =>
			this.listRepositories(context, cursor)
	};
	readonly repositories = {
		find: (context: AdapterContext, pathOrId: string) => this.find(context, pathOrId),
		createEmpty: (context: AdapterContext, path: string, idempotencyKey: string) =>
			this.createEmpty(context, path, idempotencyKey)
	};
	readonly metadata = {
		supportedComponents: new Set([
			'topics',
			'labels',
			'milestones',
			'issues',
			'change-requests',
			'releases'
		])
	};

	constructor(private readonly fetcher: typeof fetch = fetch) {}

	#client(context: AdapterContext) {
		return new ProviderHttpClient(context, 'Bearer', this.fetcher);
	}
	#url(context: AdapterContext, pathname: string): URL {
		return new URL(pathname.replace(/^\//u, ''), apiBase(context, '/api/v4'));
	}

	async testConnection(context: AdapterContext): Promise<ConnectionProbe> {
		const [version, user] = await Promise.all([
			this.#client(context).json<GitLabVersion>(this.#url(context, 'version')),
			this.#client(context).json<GitLabUser>(this.#url(context, 'user'))
		]);
		if (!version || !user) throw new Error('Provider identity response was empty.');
		return {
			product: 'GitLab',
			version: version.value.version,
			authenticatedIdentity: user.value.username
		};
	}

	async discoverCapabilities(context: AdapterContext): Promise<CapabilitySet> {
		await this.#client(context).json<GitLabUser>(this.#url(context, 'user'));
		return new Set([...read, ...(context.credential ? write : [])]);
	}

	async listNamespaces(
		context: AdapterContext,
		cursor?: string
	): Promise<InventoryPage<NamespaceInput>> {
		const page = pageCursor(cursor);
		const response = await this.#client(context).json<GitLabNamespace[]>(
			this.#url(context, `namespaces?per_page=100&page=${String(page)}`)
		);
		if (!response) throw new Error('Namespace response was empty.');
		return {
			items: response.value.map((namespace) => ({
				externalId: String(namespace.id),
				fullPath: namespace.full_path ?? namespace.path,
				kind: namespace.kind === 'user' ? 'user' : namespace.parent_id ? 'subgroup' : 'group',
				displayName: namespace.name
			})),
			nextCursor: response.headers.get('x-next-page') || null
		};
	}

	async listRepositories(
		context: AdapterContext,
		cursor?: string
	): Promise<InventoryPage<RemoteRepositoryInput>> {
		const page = pageCursor(cursor);
		const response = await this.#client(context).json<GitLabProject[]>(
			this.#url(
				context,
				`projects?membership=true&simple=true&order_by=id&sort=asc&per_page=100&page=${String(page)}`
			)
		);
		if (!response) throw new Error('Repository response was empty.');
		return {
			items: response.value.map(project),
			nextCursor: response.headers.get('x-next-page') || null
		};
	}

	async find(context: AdapterContext, pathOrId: string): Promise<RemoteRepositoryInput | null> {
		const response = await this.#client(context).json<GitLabProject>(
			this.#url(context, `projects/${encodeURIComponent(pathOrId)}`),
			{ allowNotFound: true }
		);
		return response ? project(response.value) : null;
	}

	async createEmpty(
		context: AdapterContext,
		path: string,
		idempotencyKey: string
	): Promise<RemoteRepositoryInput> {
		void idempotencyKey;
		const existing = await this.find(context, path);
		if (existing) return existing;
		const parts = path.split('/').filter(Boolean);
		const name = parts.pop();
		const namespacePath = parts.join('/');
		if (!name || !namespacePath) throw new Error('Repository path must include a namespace.');
		const namespaces = await this.#client(context).json<GitLabNamespace[]>(
			this.#url(context, `namespaces?search=${encodeURIComponent(namespacePath)}&per_page=100`)
		);
		const namespace = namespaces?.value.find(
			(item) => (item.full_path ?? item.path).toLowerCase() === namespacePath.toLowerCase()
		);
		if (!namespace) throw new Error('Target namespace was not found.');
		const created = await this.#client(context).json<GitLabProject>(
			this.#url(context, 'projects'),
			{
				method: 'POST',
				body: {
					name,
					path: name,
					namespace_id: namespace.id,
					initialize_with_readme: false,
					visibility: 'private'
				}
			}
		);
		if (!created) throw new Error('Repository creation returned no result.');
		return project(created.value);
	}

	normalize = normalizeRepository;
	resolveGitEndpoints = resolveEndpoints;
}
