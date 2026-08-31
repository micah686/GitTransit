import type { Capability, CapabilitySet } from '../domain/types';
import { ProviderHttpClient, nextPageFromLink, pageCursor, requiredBase } from './http';
import { normalizeRepository, resolveEndpoints } from './normalize';
import type {
	AdapterContext,
	ConnectionProbe,
	InventoryPage,
	NamespaceInput,
	ProviderAdapter,
	RemoteRepositoryInput
} from './types';
import { ForgeMetadataAdapter } from './forge-metadata';

interface GitHubUser {
	id: number;
	login: string;
	name?: string | null;
}
interface GitHubOrganization {
	id: number;
	login: string;
	description?: string | null;
}
interface GitHubRepository {
	id: number;
	name: string;
	full_name: string;
	clone_url: string;
	html_url: string;
	default_branch?: string;
	visibility?: string;
	private: boolean;
	archived: boolean;
	disabled: boolean;
	fork: boolean;
	has_issues?: boolean;
	has_wiki?: boolean;
	owner: { id: number; login: string };
	permissions?: { pull?: boolean; push?: boolean; admin?: boolean };
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

function repository(input: GitHubRepository): RemoteRepositoryInput {
	return {
		externalId: String(input.id),
		fullPath: input.full_name,
		cloneUrl: input.clone_url,
		pushUrl: input.clone_url,
		webUrl: input.html_url,
		namespaceExternalId: String(input.owner.id),
		defaultBranch: input.default_branch ?? null,
		visibility: input.visibility ?? (input.private ? 'private' : 'public'),
		archived: input.archived,
		disabled: input.disabled,
		fork: input.fork,
		...(input.has_issues === undefined ? {} : { hasIssues: input.has_issues }),
		...(input.has_wiki === undefined ? {} : { hasWiki: input.has_wiki }),
		hasLfs: true
	};
}

export class GitHubProviderAdapter implements ProviderAdapter {
	readonly id = 'github' as const;
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
	readonly metadata: ForgeMetadataAdapter;

	constructor(private readonly fetcher: typeof fetch = fetch) {
		this.metadata = new ForgeMetadataAdapter({
			provider: this.id,
			dialect: 'github',
			components: ['topics', 'labels', 'milestones', 'issues', 'change-requests', 'releases'],
			api: (context) => this.#api(context),
			tokenScheme: 'Bearer',
			fetcher
		});
	}

	#api(context: AdapterContext): URL {
		if (context.apiUrl) return new URL(context.apiUrl.toString().replace(/\/?$/u, '/'));
		const base = requiredBase(context);
		if (base.hostname.toLowerCase() === 'github.com') return new URL('https://api.github.com/');
		return new URL(`${base.pathname.replace(/\/$/u, '')}/api/v3/`, base.origin);
	}
	#url(context: AdapterContext, path: string): URL {
		return new URL(path.replace(/^\//u, ''), this.#api(context));
	}
	#client(context: AdapterContext) {
		return new ProviderHttpClient(context, 'Bearer', this.fetcher);
	}
	#options = {
		headers: { 'x-github-api-version': '2022-11-28', accept: 'application/vnd.github+json' }
	} as const;

	async testConnection(context: AdapterContext): Promise<ConnectionProbe> {
		const [meta, user] = await Promise.all([
			this.#client(context).json<Record<string, unknown>>(
				this.#url(context, 'meta'),
				this.#options
			),
			this.#client(context).json<GitHubUser>(this.#url(context, 'user'), this.#options)
		]);
		if (!meta || !user) throw new Error('Provider identity response was empty.');
		return {
			product:
				requiredBase(context).hostname.toLowerCase() === 'github.com'
					? 'GitHub'
					: 'GitHub Enterprise',
			version: user.headers.get('x-github-enterprise-version'),
			authenticatedIdentity: user.value.login
		};
	}

	async discoverCapabilities(context: AdapterContext): Promise<CapabilitySet> {
		await this.#client(context).json<GitHubUser>(this.#url(context, 'user'), this.#options);
		return new Set([...read, ...(context.credential ? write : [])]);
	}

	async listNamespaces(
		context: AdapterContext,
		cursor?: string
	): Promise<InventoryPage<NamespaceInput>> {
		const page = pageCursor(cursor);
		const client = this.#client(context);
		const organizations = await client.json<GitHubOrganization[]>(
			this.#url(context, `user/orgs?per_page=100&page=${String(page)}`),
			this.#options
		);
		if (!organizations) throw new Error('Namespace response was empty.');
		const items: NamespaceInput[] = organizations.value.map((organization) => ({
			externalId: String(organization.id),
			fullPath: organization.login,
			kind: 'organization',
			displayName: organization.login
		}));
		if (page === 1) {
			const user = await client.json<GitHubUser>(this.#url(context, 'user'), this.#options);
			if (user)
				items.unshift({
					externalId: String(user.value.id),
					fullPath: user.value.login,
					kind: 'user',
					displayName: user.value.name || user.value.login
				});
		}
		return { items, nextCursor: nextPageFromLink(organizations.headers) };
	}

	async listRepositories(
		context: AdapterContext,
		cursor?: string
	): Promise<InventoryPage<RemoteRepositoryInput>> {
		const page = pageCursor(cursor);
		const response = await this.#client(context).json<GitHubRepository[]>(
			this.#url(
				context,
				`user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=full_name&direction=asc&per_page=100&page=${String(page)}`
			),
			this.#options
		);
		if (!response) throw new Error('Repository response was empty.');
		return {
			items: response.value.map(repository),
			nextCursor: nextPageFromLink(response.headers)
		};
	}

	async find(context: AdapterContext, pathOrId: string): Promise<RemoteRepositoryInput | null> {
		const [owner, name, extra] = pathOrId.split('/');
		if (!owner || !name || extra) return null;
		const response = await this.#client(context).json<GitHubRepository>(
			this.#url(context, `repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`),
			{ ...this.#options, allowNotFound: true }
		);
		return response ? repository(response.value) : null;
	}

	async createEmpty(
		context: AdapterContext,
		path: string,
		idempotencyKey: string
	): Promise<RemoteRepositoryInput> {
		void idempotencyKey;
		const existing = await this.find(context, path);
		if (existing) return existing;
		const [owner, name, extra] = path.split('/');
		if (!owner || !name || extra) throw new Error('Repository path must be owner/name.');
		const user = await this.#client(context).json<GitHubUser>(
			this.#url(context, 'user'),
			this.#options
		);
		if (!user) throw new Error('Authenticated identity was unavailable.');
		const endpoint =
			user.value.login.toLowerCase() === owner.toLowerCase()
				? 'user/repos'
				: `orgs/${encodeURIComponent(owner)}/repos`;
		const created = await this.#client(context).json<GitHubRepository>(
			this.#url(context, endpoint),
			{
				...this.#options,
				method: 'POST',
				body: { name, private: true, auto_init: false }
			}
		);
		if (!created) throw new Error('Repository creation returned no result.');
		return repository(created.value);
	}

	normalize = normalizeRepository;
	resolveGitEndpoints = resolveEndpoints;
}
