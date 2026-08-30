import { describe, expect, it } from 'vitest';
import { GiteaProviderAdapter } from './gitea';
import { ForgejoProviderAdapter } from './forgejo';
import { GitLabProviderAdapter } from './gitlab';
import { GitHubProviderAdapter } from './github';
import { BitbucketCloudProviderAdapter } from './bitbucket-cloud';
import type { AdapterContext, ProviderAdapter } from './types';

type ProviderName = 'gitea' | 'forgejo' | 'gitlab' | 'github' | 'bitbucket-cloud';

function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: { 'content-type': 'application/json', ...headers }
	});
}

function giteaRepository(path = 'team/repo') {
	return {
		id: path === 'team/repo' ? 10 : 11,
		name: path.split('/')[1],
		full_name: path,
		clone_url: `https://forge.test/${path}.git`,
		html_url: `https://forge.test/${path}`,
		default_branch: 'main',
		private: true,
		archived: false,
		fork: false,
		has_issues: true,
		has_wiki: true,
		owner: { id: 2, login: path.split('/')[0] }
	};
}
function gitLabProject(path = 'parent/sub/repo') {
	return {
		id: path.endsWith('/repo') ? 20 : 21,
		name: path.split('/').at(-1),
		path_with_namespace: path,
		http_url_to_repo: `https://gitlab.test/${path}.git`,
		web_url: `https://gitlab.test/${path}`,
		default_branch: 'main',
		visibility: 'private',
		archived: false,
		issues_enabled: true,
		wiki_enabled: true,
		namespace: { id: 3, full_path: path.split('/').slice(0, -1).join('/'), path: 'sub' }
	};
}
function gitHubRepository(path = 'team/repo') {
	return {
		id: path === 'team/repo' ? 30 : 31,
		name: path.split('/')[1],
		full_name: path,
		clone_url: `https://github.test/${path}.git`,
		html_url: `https://github.test/${path}`,
		default_branch: 'main',
		visibility: 'private',
		private: true,
		archived: false,
		disabled: false,
		fork: false,
		has_issues: true,
		has_wiki: true,
		owner: { id: 4, login: path.split('/')[0] }
	};
}
function bitbucketRepository(path = 'workspace/repo') {
	return {
		uuid: path === 'workspace/repo' ? '{repo-1}' : '{repo-2}',
		full_name: path,
		name: path.split('/')[1],
		is_private: true,
		scm: 'git',
		links: {
			clone: [{ name: 'https', href: `https://bitbucket.org/${path}.git` }],
			html: { href: `https://bitbucket.org/${path}` }
		},
		owner: { uuid: '{workspace}' },
		project: { uuid: '{project}', key: 'PRJ' },
		mainbranch: { name: 'main' },
		has_issues: true,
		has_wiki: true
	};
}

function fixture(name: ProviderName): {
	adapter: ProviderAdapter;
	context: AdapterContext;
	calls: string[];
} {
	const calls: string[] = [];
	const created = new Set<string>();
	const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		calls.push(`${init?.method ?? 'GET'} ${url.pathname}${url.search}`);
		const authorization = new Headers(init?.headers).get('authorization');
		if (!authorization?.includes('good-secret')) return json({ message: 'bad credentials' }, 401);

		if (name === 'gitea' || name === 'forgejo') {
			const api = url.pathname.replace('/api/v1/', '');
			if (api === 'version') return json({ version: name === 'gitea' ? '1.24.6' : '16.0.1' });
			if (api === 'user') return json({ id: 1, login: 'me', full_name: 'Test User' });
			if (api === 'user/orgs') return json([{ id: 2, username: 'team', full_name: 'Team' }]);
			if (api === 'user/repos') {
				if (init?.method === 'POST') {
					created.add(`me/${String(JSON.parse(String(init.body)).name)}`);
					return json(giteaRepository('me/new'), 201);
				}
				return json(
					[giteaRepository(url.searchParams.get('page') === '2' ? 'team/second' : 'team/repo')],
					200,
					{
						'x-total-count': url.searchParams.get('page') === '1' ? '51' : '1'
					}
				);
			}
			if (api === 'orgs/team/repos' && init?.method === 'POST') {
				created.add('team/new');
				return json(giteaRepository('team/new'), 201);
			}
			if (api === 'repos/team/repo') return json(giteaRepository());
			if (api === 'repos/team/new')
				return created.has('team/new') ? json(giteaRepository('team/new')) : json({}, 404);
		}

		if (name === 'gitlab') {
			const api = url.pathname.replace('/api/v4/', '');
			if (api === 'version') return json({ version: '18.4.0' });
			if (api === 'user') return json({ id: 1, username: 'me', name: 'Test User' });
			if (api === 'namespaces')
				return json([
					{ id: 3, name: 'Sub', path: 'sub', full_path: 'parent/sub', kind: 'group', parent_id: 2 }
				]);
			if (api === 'projects' && init?.method === 'POST') {
				created.add('parent/sub/new');
				return json(gitLabProject('parent/sub/new'), 201);
			}
			if (api === 'projects')
				return json(
					[
						gitLabProject(
							url.searchParams.get('page') === '2' ? 'parent/sub/second' : 'parent/sub/repo'
						)
					],
					200,
					{ 'x-next-page': url.searchParams.get('page') === '1' ? '2' : '' }
				);
			const id = decodeURIComponent(api.replace('projects/', ''));
			if (id === 'parent/sub/repo') return json(gitLabProject());
			if (id === 'parent/sub/new') return created.has(id) ? json(gitLabProject(id)) : json({}, 404);
		}

		if (name === 'github') {
			const api = url.pathname.replace('/api/v3/', '');
			if (api === 'meta') return json({ installed_version: '3.19' });
			if (api === 'user')
				return json({ id: 1, login: 'me', name: 'Test User' }, 200, {
					'x-github-enterprise-version': '3.19.1'
				});
			if (api === 'user/orgs') return json([{ id: 4, login: 'team' }]);
			if (api === 'user/repos')
				return json(
					[gitHubRepository(url.searchParams.get('page') === '2' ? 'team/second' : 'team/repo')],
					200,
					url.searchParams.get('page') === '1'
						? { link: '<https://github.test/api/v3/user/repos?page=2>; rel="next"' }
						: {}
				);
			if (api === 'orgs/team/repos' && init?.method === 'POST') {
				created.add('team/new');
				return json(gitHubRepository('team/new'), 201);
			}
			if (api === 'repos/team/repo') return json(gitHubRepository());
			if (api === 'repos/team/new')
				return created.has('team/new') ? json(gitHubRepository('team/new')) : json({}, 404);
		}

		if (name === 'bitbucket-cloud') {
			const api = url.pathname.replace('/2.0/', '');
			if (api === 'user') return json({ uuid: '{me}', nickname: 'me', display_name: 'Test User' });
			if (api === 'user/workspaces')
				return json({
					values: [{ workspace: { uuid: '{workspace}', slug: 'workspace', name: 'Workspace' } }],
					...(url.searchParams.get('page')
						? {}
						: { next: 'https://api.bitbucket.org/2.0/user/workspaces?page=2' })
				});
			if (api === 'user/permissions/repositories')
				return json({
					values: [
						{
							permission: 'admin',
							repository: bitbucketRepository(
								url.searchParams.get('page') ? 'workspace/second' : 'workspace/repo'
							)
						}
					],
					...(url.searchParams.get('page')
						? {}
						: { next: 'https://api.bitbucket.org/2.0/user/permissions/repositories?page=2' })
				});
			if (api === 'repositories/workspace/repo') return json(bitbucketRepository());
			if (api === 'repositories/workspace/new' && init?.method === 'POST') {
				created.add('workspace/new');
				return json(bitbucketRepository('workspace/new'), 201);
			}
			if (api === 'repositories/workspace/new')
				return created.has('workspace/new')
					? json(bitbucketRepository('workspace/new'))
					: json({}, 404);
		}
		return json({ message: `unhandled ${url.toString()}` }, 500);
	}) as typeof fetch;

	const adapter =
		name === 'gitea'
			? new GiteaProviderAdapter(fetcher)
			: name === 'forgejo'
				? new ForgejoProviderAdapter(fetcher)
				: name === 'gitlab'
					? new GitLabProviderAdapter(fetcher)
					: name === 'github'
						? new GitHubProviderAdapter(fetcher)
						: new BitbucketCloudProviderAdapter(fetcher);
	const baseUrl =
		name === 'bitbucket-cloud' ? new URL('https://bitbucket.org') : new URL(`https://${name}.test`);
	return {
		adapter,
		calls,
		context: {
			connectionId: `${name}-1`,
			signal: new AbortController().signal,
			baseUrl,
			credential: { kind: 'token', secret: 'good-secret' }
		}
	};
}

describe.each<ProviderName>(['gitea', 'forgejo', 'gitlab', 'github', 'bitbucket-cloud'])(
	'%s named-provider contract',
	(name) => {
		it('tests identity and exposes credential-aware source and target capabilities', async () => {
			const { adapter, context } = fixture(name);
			const probe = await adapter.testConnection(context);
			const capabilities = await adapter.discoverCapabilities(context);
			expect(probe.authenticatedIdentity).toBe('me');
			expect(capabilities.has('git:fetch')).toBe(true);
			expect(capabilities.has('git:push')).toBe(true);
			expect(capabilities.has('repository:create')).toBe(true);
		});

		it('paginates namespaces and repositories without losing stable paths', async () => {
			const { adapter, context } = fixture(name);
			const firstNamespaces = await adapter.inventory!.listNamespaces!(context);
			expect(firstNamespaces.items.length).toBeGreaterThan(0);
			const first = await adapter.inventory!.listRepositories(context);
			expect(first.items).toHaveLength(1);
			expect(first.items[0]?.externalId).toBeTruthy();
			expect(first.items[0]?.fullPath.split('/').length).toBeGreaterThanOrEqual(2);
			if (first.nextCursor) {
				const second = await adapter.inventory!.listRepositories(context, first.nextCursor);
				expect(second.items[0]?.externalId).not.toBe(first.items[0]?.externalId);
			}
		});

		it('finds and idempotently creates an empty repository with safe Git endpoints', async () => {
			const { adapter, context, calls } = fixture(name);
			const existingPath =
				name === 'gitlab'
					? 'parent/sub/repo'
					: name === 'bitbucket-cloud'
						? 'workspace/repo'
						: 'team/repo';
			const newPath =
				name === 'gitlab'
					? 'parent/sub/new'
					: name === 'bitbucket-cloud'
						? 'workspace/new'
						: 'team/new';
			const existing = await adapter.repositories!.find(context, existingPath);
			expect(existing).not.toBeNull();
			const created = await adapter.repositories!.createEmpty(context, newPath, 'operation-1');
			const repeated = await adapter.repositories!.createEmpty(context, newPath, 'operation-1');
			expect(repeated.externalId).toBe(created.externalId);
			const normalized = adapter.normalize(created);
			expect(normalized.normalizedPath).toBe(newPath.toLowerCase());
			const endpoints = adapter.resolveGitEndpoints!(created);
			expect(endpoints.fetchUrl.username).toBe('');
			expect(endpoints.pushUrl.protocol).toBe('https:');
			expect(calls.filter((call) => call.startsWith('POST '))).toHaveLength(1);
		});

		it('normalizes invalid credentials to a secret-free typed error', async () => {
			const { adapter, context } = fixture(name);
			const invalid = {
				...context,
				credential: { kind: 'token' as const, secret: 'wrong-secret' }
			};
			await expect(adapter.testConnection(invalid)).rejects.toMatchObject({
				kind: 'unauthorized',
				status: 401
			});
			await expect(adapter.testConnection(invalid)).rejects.not.toThrow('wrong-secret');
		});
	}
);

describe('same-provider instance isolation', () => {
	it('keeps two Gitea API origins and identities independent', async () => {
		const fetcher = (async (input: string | URL | Request) => {
			const url = new URL(input instanceof Request ? input.url : String(input));
			if (url.pathname.endsWith('/version'))
				return json({ version: url.hostname === 'a.test' ? '1.23' : '1.24' });
			if (url.pathname.endsWith('/user'))
				return json({ id: 1, login: url.hostname === 'a.test' ? 'side-a' : 'side-b' });
			return json({}, 404);
		}) as typeof fetch;
		const adapter = new GiteaProviderAdapter(fetcher);
		const context = (host: string): AdapterContext => ({
			connectionId: host,
			signal: new AbortController().signal,
			baseUrl: new URL(`https://${host}`),
			credential: { kind: 'token', secret: 'token' }
		});
		const [a, b] = await Promise.all([
			adapter.testConnection(context('a.test')),
			adapter.testConnection(context('b.test'))
		]);
		expect([a.authenticatedIdentity, b.authenticatedIdentity]).toEqual(['side-a', 'side-b']);
		expect([a.version, b.version]).toEqual(['1.23', '1.24']);
	});
});
