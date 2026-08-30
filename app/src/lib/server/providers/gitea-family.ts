import type { Capability, CapabilitySet, ProviderId } from '../domain/types';
import { ProviderHttpClient, apiBase, nextPageFromLink, pageCursor } from './http';
import { normalizeRepository, resolveEndpoints } from './normalize';
import type {
	AdapterContext,
	ConnectionProbe,
	InventoryPage,
	NamespaceInput,
	ProviderAdapter,
	RemoteRepositoryInput
} from './types';

interface GiteaUser {
	id: number;
	login: string;
	full_name?: string;
}
interface GiteaVersion {
	version: string;
}
interface GiteaOrganization {
	id: number;
	username: string;
	full_name?: string;
}
interface GiteaRepository {
	id: number;
	name: string;
	full_name: string;
	clone_url: string;
	ssh_url?: string;
	html_url?: string;
	default_branch?: string;
	private?: boolean;
	internal?: boolean;
	archived?: boolean;
	empty?: boolean;
	fork?: boolean;
	has_issues?: boolean;
	has_wiki?: boolean;
	owner: { id: number; login: string };
}

const readCapabilities: readonly Capability[] = [
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
	'wiki:fetch'
];
const writeCapabilities: readonly Capability[] = [
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
	'wiki:push'
];

function nextPage(headers: Headers, current: number, count: number): string | null {
	const linked = nextPageFromLink(headers);
	if (linked) return linked;
	const total = Number(headers.get('x-total-count') ?? '0');
	return total > current * 50 || count === 50 ? String(current + 1) : null;
}

function repository(input: GiteaRepository): RemoteRepositoryInput {
	return {
		externalId: String(input.id),
		fullPath: input.full_name,
		cloneUrl: input.clone_url,
		pushUrl: input.clone_url,
		...(input.html_url ? { webUrl: input.html_url } : {}),
		namespaceExternalId: String(input.owner.id),
		defaultBranch: input.default_branch ?? null,
		visibility: input.private ? 'private' : input.internal ? 'internal' : 'public',
		archived: input.archived ?? false,
		disabled: false,
		fork: input.fork ?? false,
		...(input.has_issues === undefined ? {} : { hasIssues: input.has_issues }),
		...(input.has_wiki === undefined ? {} : { hasWiki: input.has_wiki })
	};
}

export class GiteaFamilyAdapter implements ProviderAdapter {
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

	constructor(
		readonly id: Extract<ProviderId, 'gitea' | 'forgejo'>,
		private readonly productName: string,
		private readonly fetcher: typeof fetch = fetch
	) {}

	#client(context: AdapterContext): ProviderHttpClient {
		return new ProviderHttpClient(context, 'token', this.fetcher);
	}

	#url(context: AdapterContext, pathname: string): URL {
		return new URL(pathname.replace(/^\//u, ''), apiBase(context, '/api/v1'));
	}

	async testConnection(context: AdapterContext): Promise<ConnectionProbe> {
		const client = this.#client(context);
		const [version, user] = await Promise.all([
			client.json<GiteaVersion>(this.#url(context, 'version')),
			client.json<GiteaUser>(this.#url(context, 'user'))
		]);
		if (!version || !user) throw new Error('Provider identity response was empty.');
		return {
			product: this.productName,
			version: version.value.version,
			authenticatedIdentity: user.value.login
		};
	}

	async discoverCapabilities(context: AdapterContext): Promise<CapabilitySet> {
		await this.#client(context).json<GiteaUser>(this.#url(context, 'user'));
		return new Set([
			...readCapabilities,
			...(context.credential ? writeCapabilities : []),
			'lfs:fetch',
			...(context.credential ? (['lfs:push'] as const) : [])
		]);
	}

	async listNamespaces(
		context: AdapterContext,
		cursor?: string
	): Promise<InventoryPage<NamespaceInput>> {
		const page = pageCursor(cursor);
		const client = this.#client(context);
		const response = await client.json<GiteaOrganization[]>(
			this.#url(context, `user/orgs?page=${String(page)}&limit=50`)
		);
		if (!response) throw new Error('Namespace response was empty.');
		const items: NamespaceInput[] = response.value.map((organization) => ({
			externalId: String(organization.id),
			fullPath: organization.username,
			kind: 'organization',
			displayName: organization.full_name || organization.username
		}));
		if (page === 1) {
			const user = await client.json<GiteaUser>(this.#url(context, 'user'));
			if (user)
				items.unshift({
					externalId: String(user.value.id),
					fullPath: user.value.login,
					kind: 'user',
					displayName: user.value.full_name || user.value.login
				});
		}
		return { items, nextCursor: nextPage(response.headers, page, response.value.length) };
	}

	async listRepositories(
		context: AdapterContext,
		cursor?: string
	): Promise<InventoryPage<RemoteRepositoryInput>> {
		const page = pageCursor(cursor);
		const response = await this.#client(context).json<GiteaRepository[]>(
			this.#url(context, `user/repos?page=${String(page)}&limit=50`)
		);
		if (!response) throw new Error('Repository response was empty.');
		return {
			items: response.value.map(repository),
			nextCursor: nextPage(response.headers, page, response.value.length)
		};
	}

	async find(context: AdapterContext, pathOrId: string): Promise<RemoteRepositoryInput | null> {
		const parts = pathOrId.split('/').filter(Boolean);
		if (parts.length !== 2) return null;
		const response = await this.#client(context).json<GiteaRepository>(
			this.#url(context, `repos/${encodeURIComponent(parts[0]!)}/${encodeURIComponent(parts[1]!)}`),
			{ allowNotFound: true }
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
		const user = await this.#client(context).json<GiteaUser>(this.#url(context, 'user'));
		if (!user) throw new Error('Authenticated identity was unavailable.');
		const endpoint =
			user.value.login.toLowerCase() === owner.toLowerCase()
				? 'user/repos'
				: `orgs/${encodeURIComponent(owner)}/repos`;
		const created = await this.#client(context).json<GiteaRepository>(
			this.#url(context, endpoint),
			{ method: 'POST', body: { name, auto_init: false, private: true } }
		);
		if (!created) throw new Error('Repository creation returned no result.');
		return repository(created.value);
	}

	normalize = normalizeRepository;
	resolveGitEndpoints = resolveEndpoints;
}
