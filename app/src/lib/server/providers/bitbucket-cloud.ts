import type { Capability, CapabilitySet } from '../domain/types';
import { ProviderHttpClient, requiredBase } from './http';
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

interface BitbucketPage<T> {
	values: T[];
	next?: string;
}
interface BitbucketUser {
	uuid: string;
	username?: string;
	nickname?: string;
	display_name: string;
}
interface BitbucketWorkspace {
	uuid: string;
	slug: string;
	name: string;
}
interface BitbucketRepository {
	uuid: string;
	full_name: string;
	name: string;
	is_private: boolean;
	scm: string;
	links: { clone: { name: string; href: string }[]; html?: { href: string } };
	owner?: { uuid?: string; nickname?: string; username?: string };
	project?: { uuid?: string; key?: string; name?: string };
	mainbranch?: { name?: string } | null;
	has_issues?: boolean;
	has_wiki?: boolean;
	updated_on?: string;
}
interface BitbucketPermission {
	permission: 'read' | 'write' | 'admin';
	repository: BitbucketRepository;
}

const read: readonly Capability[] = [
	'identity:read',
	'namespace:list',
	'repository:list',
	'repository:read',
	'git:fetch',
	'issues:read',
	'change-requests:read',
	'wiki:fetch',
	'lfs:fetch'
];
const write: readonly Capability[] = [
	'repository:create',
	'repository:update',
	'git:push',
	'git:delete-ref',
	'issues:write',
	'change-requests:write',
	'wiki:push',
	'lfs:push'
];

function repository(input: BitbucketRepository): RemoteRepositoryInput {
	const clone = input.links.clone.find((link) => link.name === 'https') ?? input.links.clone[0];
	if (!clone) throw new Error('Bitbucket repository did not include a clone endpoint.');
	return {
		externalId: input.uuid,
		fullPath: input.full_name,
		cloneUrl: clone.href,
		pushUrl: clone.href,
		...(input.links.html?.href ? { webUrl: input.links.html.href } : {}),
		...(input.owner?.uuid ? { namespaceExternalId: input.owner.uuid } : {}),
		defaultBranch: input.mainbranch?.name ?? null,
		visibility: input.is_private ? 'private' : 'public',
		archived: false,
		disabled: input.scm !== 'git',
		fork: false,
		...(input.has_issues === undefined ? {} : { hasIssues: input.has_issues }),
		...(input.has_wiki === undefined ? {} : { hasWiki: input.has_wiki }),
		hasLfs: true,
		providerMetadata: {
			project: input.project
				? {
						externalId: input.project.uuid ?? null,
						key: input.project.key ?? null,
						name: input.project.name ?? null
					}
				: null
		}
	};
}

export class BitbucketCloudProviderAdapter implements ProviderAdapter {
	readonly id = 'bitbucket-cloud' as const;
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
			dialect: 'bitbucket-cloud',
			components: ['issues', 'change-requests'],
			api: (context) => this.#api(context),
			tokenScheme: 'Bearer',
			fetcher
		});
	}

	#api(context: AdapterContext): URL {
		if (context.apiUrl) return new URL(context.apiUrl.toString().replace(/\/?$/u, '/'));
		const base = requiredBase(context);
		if (base.hostname.toLowerCase() !== 'bitbucket.org')
			throw new Error('Bitbucket Cloud connections must use https://bitbucket.org.');
		return new URL('https://api.bitbucket.org/2.0/');
	}
	#url(context: AdapterContext, value: string): URL {
		const api = this.#api(context);
		const url = new URL(value, api);
		if (url.origin !== api.origin || !url.pathname.startsWith(api.pathname))
			throw new Error('Bitbucket pagination cursor crossed the API boundary.');
		return url;
	}
	#client(context: AdapterContext) {
		return new ProviderHttpClient(context, 'Bearer', this.fetcher);
	}

	async testConnection(context: AdapterContext): Promise<ConnectionProbe> {
		const user = await this.#client(context).json<BitbucketUser>(this.#url(context, 'user'));
		if (!user) throw new Error('Provider identity response was empty.');
		return {
			product: 'Bitbucket Cloud',
			version: '2.0',
			authenticatedIdentity: user.value.nickname ?? user.value.username ?? user.value.display_name
		};
	}

	async discoverCapabilities(context: AdapterContext): Promise<CapabilitySet> {
		await this.#client(context).json<BitbucketUser>(this.#url(context, 'user'));
		return new Set([...read, ...(context.credential ? write : [])]);
	}

	async listNamespaces(
		context: AdapterContext,
		cursor?: string
	): Promise<InventoryPage<NamespaceInput>> {
		const url = cursor
			? this.#url(context, cursor)
			: this.#url(context, 'user/workspaces?pagelen=100');
		const response =
			await this.#client(context).json<
				BitbucketPage<{ workspace: BitbucketWorkspace } | BitbucketWorkspace>
			>(url);
		if (!response) throw new Error('Workspace response was empty.');
		return {
			items: response.value.values.map((entry) => {
				const workspace = 'workspace' in entry ? entry.workspace : entry;
				return {
					externalId: workspace.uuid,
					fullPath: workspace.slug,
					kind: 'workspace',
					displayName: workspace.name
				};
			}),
			nextCursor: response.value.next ?? null
		};
	}

	async listRepositories(
		context: AdapterContext,
		cursor?: string
	): Promise<InventoryPage<RemoteRepositoryInput>> {
		const url = cursor
			? this.#url(context, cursor)
			: this.#url(context, 'user/permissions/repositories?pagelen=100');
		const response =
			await this.#client(context).json<BitbucketPage<BitbucketPermission | BitbucketRepository>>(
				url
			);
		if (!response) throw new Error('Repository response was empty.');
		return {
			items: response.value.values.map((entry) =>
				repository('repository' in entry ? entry.repository : entry)
			),
			nextCursor: response.value.next ?? null
		};
	}

	async find(context: AdapterContext, pathOrId: string): Promise<RemoteRepositoryInput | null> {
		const [workspace, slug, extra] = pathOrId.split('/');
		if (!workspace || !slug || extra) return null;
		const response = await this.#client(context).json<BitbucketRepository>(
			this.#url(
				context,
				`repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(slug)}`
			),
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
		const [workspace, slug, extra] = path.split('/');
		if (!workspace || !slug || extra) throw new Error('Repository path must be workspace/slug.');
		const created = await this.#client(context).json<BitbucketRepository>(
			this.#url(
				context,
				`repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(slug)}`
			),
			{ method: 'POST', body: { scm: 'git', is_private: true } }
		);
		if (!created) throw new Error('Repository creation returned no result.');
		return repository(created.value);
	}

	normalize = normalizeRepository;
	resolveGitEndpoints = resolveEndpoints;
}
