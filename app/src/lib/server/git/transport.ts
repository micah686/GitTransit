import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ImmutableRefPlan, Oid, RefAction, RefMap, RefName, Side } from '../domain/types';
import { oid, refName } from '../domain/types';
import { createCredentialScope, type CredentialScope } from './credentials';
import { runProcess, SafeProcessError } from './process';
import type {
	AuthenticatedEndpoint,
	GitTransport,
	RemoteLease,
	VerifiedArtifact,
	Workspace
} from './types';

const DEFAULT_REFS = ['refs/heads/*', 'refs/tags/*'] as const;
const NULL_OID = '0000000000000000000000000000000000000000';

export interface ControlledGitOptions {
	readonly workspaceRoot: string;
	readonly artifactRoot: string;
	readonly timeoutMs?: number;
}

function safeKey(value: string): string {
	return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function endpointArgument(endpoint: AuthenticatedEndpoint): string {
	if (endpoint.url.password || (endpoint.url.username && !['ssh:'].includes(endpoint.url.protocol)))
		throw new Error('Git URLs must not contain embedded HTTP credentials.');
	return endpoint.url.protocol === 'file:' ? endpoint.url.pathname : endpoint.url.toString();
}

function managedRef(value: string): value is RefName {
	return (
		(value.startsWith('refs/heads/') || value.startsWith('refs/tags/')) &&
		!value.endsWith('^{}') &&
		!value.includes('..') &&
		!value.includes('@{')
	);
}

function parseLsRemote(output: string): RefMap {
	const refs = new Map<RefName, Oid>();
	for (const line of output.split('\n')) {
		if (!line.trim()) continue;
		const [objectId, name, extra] = line.trim().split(/\s+/u);
		if (extra || !objectId || !name || !/^[0-9a-f]{40,64}$/iu.test(objectId) || !managedRef(name))
			continue;
		refs.set(refName(name), oid(objectId.toLowerCase()));
	}
	return refs;
}

function matchesPattern(ref: string, pattern: string): boolean {
	if (!pattern.endsWith('*')) return ref === pattern;
	return ref.startsWith(pattern.slice(0, -1));
}

function selectedRefs(refs: RefMap, patterns: readonly string[]): RefMap {
	const effective = patterns.length ? patterns : DEFAULT_REFS;
	return new Map(
		[...refs].filter(([name]) => effective.some((pattern) => matchesPattern(name, pattern)))
	);
}

async function withCredential<T>(
	endpoint: AuthenticatedEndpoint,
	operation: (scope: CredentialScope | null) => Promise<T>
): Promise<T> {
	const scope = endpoint.credential ? await createCredentialScope(endpoint.credential) : null;
	try {
		return await operation(scope);
	} finally {
		await scope?.dispose();
	}
}

export class ControlledGitTransport implements GitTransport {
	readonly #timeoutMs: number;

	constructor(private readonly options: ControlledGitOptions) {
		this.#timeoutMs = options.timeoutMs ?? 120_000;
	}

	async #git(
		args: readonly string[],
		options: { cwd?: string; scope?: CredentialScope | null; timeoutMs?: number } = {}
	): Promise<string> {
		const result = await runProcess({
			command: 'git',
			args,
			...(options.cwd ? { cwd: options.cwd } : {}),
			env: {
				GIT_TERMINAL_PROMPT: '0',
				GCM_INTERACTIVE: 'never',
				GIT_CONFIG_NOSYSTEM: '1',
				...(options.scope?.env ?? {})
			},
			timeoutMs: options.timeoutMs ?? this.#timeoutMs,
			...(options.scope ? { redact: options.scope.redact } : {})
		});
		return result.stdout;
	}

	async lsRemote(endpoint: AuthenticatedEndpoint): Promise<RefMap> {
		return withCredential(endpoint, async (scope) =>
			parseLsRemote(
				await this.#git(['ls-remote', '--heads', '--tags', endpointArgument(endpoint)], { scope })
			)
		);
	}

	async prepareWorkspace(
		routeId: string,
		runId: string,
		endpoints: Readonly<Record<Side, AuthenticatedEndpoint>>
	): Promise<Workspace> {
		const routeKey = safeKey(routeId);
		const repositoryPath = path.join(this.options.workspaceRoot, 'routes', routeKey, 'objects.git');
		const controlPath = path.join(
			this.options.workspaceRoot,
			'runs',
			`${safeKey(runId)}-${randomUUID()}`
		);
		await mkdir(path.dirname(repositoryPath), { recursive: true, mode: 0o700 });
		await mkdir(path.dirname(controlPath), { recursive: true, mode: 0o700 });
		await mkdir(controlPath, { recursive: false, mode: 0o700 });
		try {
			await stat(path.join(repositoryPath, 'HEAD'));
		} catch {
			await this.#git(['init', '--bare', repositoryPath], { cwd: controlPath });
		}
		return {
			routeId,
			runId,
			repositoryPath,
			controlPath,
			endpoints,
			transient: routeId.startsWith('preview-')
		};
	}

	async fetch(workspace: Workspace, side: Side, refs: readonly string[]): Promise<RefMap> {
		const endpoint = workspace.endpoints[side];
		const inventory = selectedRefs(await this.lsRemote(endpoint), refs);
		if (!inventory.size) return inventory;
		const namespace = `refs/gittransit/observations/${side.toLowerCase()}`;
		const refspecs = [...inventory.keys()].map((name) => `+${name}:${namespace}/${name.slice(5)}`);
		await withCredential(endpoint, (scope) =>
			this.#git(
				[
					'--git-dir',
					workspace.repositoryPath,
					'fetch',
					'--no-tags',
					endpointArgument(endpoint),
					...refspecs
				],
				{ cwd: workspace.controlPath, scope }
			)
		);
		return inventory;
	}

	async isAncestor(workspace: Workspace, older: Oid, newer: Oid): Promise<boolean> {
		try {
			await this.#git([
				'--git-dir',
				workspace.repositoryPath,
				'merge-base',
				'--is-ancestor',
				older,
				newer
			]);
			return true;
		} catch (error) {
			if (error instanceof SafeProcessError && error.exitCode === 1) return false;
			throw error;
		}
	}

	async push(
		workspace: Workspace,
		to: Side,
		plan: ImmutableRefPlan,
		leases: readonly RemoteLease[]
	): Promise<RefMap> {
		const endpoint = workspace.endpoints[to];
		const actions: Exclude<RefAction, { kind: 'noop' | 'conflict' }>[] = [];
		for (const action of plan.actions) {
			if (action.kind === 'noop' || action.kind === 'conflict') continue;
			if (action.kind === 'delete' ? action.from === to : action.to === to) actions.push(action);
		}
		if (!actions.length) return this.lsRemote(endpoint);
		const leaseByRef = new Map(leases.map((lease) => [lease.ref, lease.expectedOid]));
		const leaseArgs: string[] = [];
		const refspecs: string[] = [];
		for (const action of actions) {
			const expected = leaseByRef.get(action.ref);
			if (expected === undefined) throw new Error(`Missing remote lease for ${action.ref}.`);
			leaseArgs.push(`--force-with-lease=${action.ref}:${expected ?? NULL_OID}`);
			refspecs.push(action.kind === 'delete' ? `:${action.ref}` : `${action.newOid}:${action.ref}`);
		}
		const pushArgs = [
			'--git-dir',
			workspace.repositoryPath,
			'push',
			'--porcelain',
			'--atomic',
			...leaseArgs,
			endpointArgument(endpoint),
			...refspecs
		];
		await withCredential(endpoint, (scope) =>
			this.#git(pushArgs, { cwd: workspace.controlPath, scope })
		);
		const observed = await this.lsRemote(endpoint);
		for (const action of actions) {
			const actual = observed.get(action.ref) ?? null;
			const expected = action.kind === 'delete' ? null : action.newOid;
			if (actual !== expected) throw new Error(`Verification failed for ${action.ref}.`);
		}
		return observed;
	}

	async createBundle(workspace: Workspace, side: Side): Promise<VerifiedArtifact> {
		const endpoint = workspace.endpoints[side];
		const refs = await this.lsRemote(endpoint);
		if (!refs.size) throw new Error('Cannot create a restorable bundle for an empty endpoint.');
		const backupRepository = path.join(workspace.controlPath, `backup-${side.toLowerCase()}.git`);
		await this.#git(['init', '--bare', backupRepository], { cwd: workspace.controlPath });
		await withCredential(endpoint, (scope) =>
			this.#git(
				[
					'--git-dir',
					backupRepository,
					'fetch',
					'--no-tags',
					endpointArgument(endpoint),
					...[...refs.keys()].map((name) => `+${name}:${name}`)
				],
				{ cwd: workspace.controlPath, scope }
			)
		);
		const directory = path.join(this.options.artifactRoot, safeKey(workspace.routeId));
		await mkdir(directory, { recursive: true, mode: 0o700 });
		const finalPath = path.join(
			directory,
			`${safeKey(workspace.runId)}-${side.toLowerCase()}.bundle`
		);
		const temporaryPath = `${finalPath}.${randomUUID()}.tmp`;
		await this.#git(['--git-dir', backupRepository, 'bundle', 'create', temporaryPath, '--all']);
		await this.#git(['--git-dir', backupRepository, 'bundle', 'verify', temporaryPath]);
		const contents = await import('node:fs/promises').then(({ readFile }) =>
			readFile(temporaryPath)
		);
		const digest = createHash('sha256').update(contents).digest('hex');
		await rename(temporaryPath, finalPath);
		return { path: finalPath, digest, byteSize: contents.byteLength };
	}

	async isLfsAvailable(): Promise<boolean> {
		try {
			await this.#git(['lfs', 'version'], { timeoutMs: 10_000 });
			return true;
		} catch {
			return false;
		}
	}

	async transferLfs(
		workspace: Workspace,
		from: Side,
		to: Side,
		refs: readonly string[]
	): Promise<void> {
		if (!(await this.isLfsAvailable()))
			throw new Error('Git LFS is required but is not installed.');
		const source = workspace.endpoints[from];
		const target = workspace.endpoints[to];
		const sourceRemote = 'gittransit-lfs-source';
		const targetRemote = 'gittransit-lfs-target';
		await withCredential(source, (scope) =>
			this.#git(
				[
					'--git-dir',
					workspace.repositoryPath,
					'-c',
					`remote.${sourceRemote}.url=${endpointArgument(source)}`,
					'lfs',
					'fetch',
					sourceRemote,
					...refs
				],
				{ cwd: workspace.controlPath, scope }
			)
		);
		const localRefs = refs.map(
			(ref) => `refs/gittransit/observations/${from.toLowerCase()}/${ref.slice(5)}`
		);
		await withCredential(target, (scope) =>
			this.#git(
				[
					'--git-dir',
					workspace.repositoryPath,
					'-c',
					`remote.${targetRemote}.url=${endpointArgument(target)}`,
					'lfs',
					'push',
					targetRemote,
					...localRefs
				],
				{ cwd: workspace.controlPath, scope }
			)
		);
	}

	async disposeWorkspace(workspace: Workspace): Promise<void> {
		await rm(workspace.controlPath, { recursive: true, force: true });
		if (workspace.transient)
			await rm(path.dirname(workspace.repositoryPath), { recursive: true, force: true });
	}
}
