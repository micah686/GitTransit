import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { entityId, refName, oid, type RefBaseline } from '../domain/types';
import { ControlledGitTransport } from './transport';
import { executeTwoWay } from './two-way';
const exec = promisify(execFile);
const git = async (cwd: string, ...args: string[]) =>
	(await exec('git', args, { cwd })).stdout.trim();
async function commit(work: string, text: string, message: string) {
	await writeFile(join(work, 'file.txt'), text);
	await git(work, 'add', 'file.txt');
	await git(work, 'commit', '-m', message);
	return git(work, 'rev-parse', 'HEAD');
}
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'gittransit-two-way-')),
		a = join(root, 'a.git'),
		b = join(root, 'b.git'),
		workA = join(root, 'work-a'),
		workB = join(root, 'work-b');
	await git(root, 'init', '--bare', a);
	await git(root, 'init', '--bare', b);
	await git(root, 'init', '-b', 'main', workA);
	await git(workA, 'config', 'user.email', 'two-way@test.invalid');
	await git(workA, 'config', 'user.name', 'Two Way');
	const base = await commit(workA, 'base', 'base');
	await git(workA, 'remote', 'add', 'a', a);
	await git(workA, 'push', 'a', 'main');
	const transport = new ControlledGitTransport({
		workspaceRoot: join(root, 'workspaces'),
		artifactRoot: join(root, 'artifacts')
	});
	const endpoint = (url: string) => ({
		url: pathToFileURL(url),
		credentialId: null,
		stableIdentity: url
	});
	const request = {
		routeId: entityId('route'),
		endpointA: endpoint(a),
		endpointB: endpoint(b),
		refs: { includes: ['refs/heads/*'], excludes: [], targetOnly: 'delete-with-approval' as const },
		safety: { strategy: 'backup-and-apply' as const, requireBackup: true },
		lfs: 'off' as const,
		capabilityGeneration: 1,
		policyGeneration: 1,
		assertLeaseCurrent: () => true
	};
	return { root, a, b, workA, workB, base, transport, request };
}
describe('two-way Git reconciliation', () => {
	it('requires equality for an uninitialized route and can explicitly seed A to B', async () => {
		const f = await fixture();
		try {
			const blocked = await executeTwoWay(f.transport, {
				...f.request,
				runId: 'equal',
				baselines: new Map(),
				initialized: false,
				initialMode: 'require-equality'
			});
			expect(blocked.state).toBe('conflicted');
			await expect(git(f.root, '--git-dir', f.b, 'rev-parse', 'refs/heads/main')).rejects.toThrow();
			const seeded = await executeTwoWay(f.transport, {
				...f.request,
				runId: 'seed',
				baselines: new Map(),
				initialized: false,
				initialMode: 'seed-a-to-b'
			});
			expect(seeded.state).toBe('succeeded');
			expect(await git(f.root, '--git-dir', f.b, 'rev-parse', 'refs/heads/main')).toBe(f.base);
			const equal = await executeTwoWay(f.transport, {
				...f.request,
				runId: 'equal-baseline',
				baselines: new Map(),
				initialized: false,
				initialMode: 'require-equality'
			});
			expect(equal.state).toBe('succeeded');
		} finally {
			await rm(f.root, { recursive: true, force: true });
		}
	}, 20_000);

	it('supports explicit B-to-A seed initialization', async () => {
		const f = await fixture();
		try {
			await git(f.workA, 'push', f.b, 'main');
			await git(f.root, '--git-dir', f.a, 'update-ref', '-d', 'refs/heads/main');
			const result = await executeTwoWay(f.transport, {
				...f.request,
				runId: 'seed-b',
				baselines: new Map(),
				initialized: false,
				initialMode: 'seed-b-to-a'
			});
			expect(result.state).toBe('succeeded');
			expect(await git(f.root, '--git-dir', f.a, 'rev-parse', 'refs/heads/main')).toBe(f.base);
		} finally {
			await rm(f.root, { recursive: true, force: true });
		}
	}, 20_000);
	it('propagates A-only and then B-only changes from the successful baseline', async () => {
		const f = await fixture();
		try {
			await git(f.workA, 'push', f.b, 'main');
			let baseline = new Map([
				[refName('refs/heads/main'), { a: oid(f.base), b: oid(f.base) } satisfies RefBaseline]
			]);
			const aTip = await commit(f.workA, 'from-a', 'A change');
			await git(f.workA, 'push', 'a', 'main');
			let result = await executeTwoWay(f.transport, {
				...f.request,
				runId: 'a-to-b',
				baselines: baseline,
				initialized: true,
				initialMode: 'require-equality'
			});
			expect(result.state).toBe('succeeded');
			expect(await git(f.root, '--git-dir', f.b, 'rev-parse', 'refs/heads/main')).toBe(aTip);
			baseline = new Map([[refName('refs/heads/main'), { a: oid(aTip), b: oid(aTip) }]]);
			await git(f.root, 'clone', f.b, f.workB);
			await git(f.workB, 'checkout', 'main');
			await git(f.workB, 'config', 'user.email', 'two-way@test.invalid');
			await git(f.workB, 'config', 'user.name', 'Two Way');
			const bTip = await commit(f.workB, 'from-b', 'B change');
			await git(f.workB, 'push', 'origin', 'main');
			result = await executeTwoWay(f.transport, {
				...f.request,
				runId: 'b-to-a',
				baselines: baseline,
				initialized: true,
				initialMode: 'require-equality'
			});
			expect(result.state).toBe('succeeded');
			expect(await git(f.root, '--git-dir', f.a, 'rev-parse', 'refs/heads/main')).toBe(bTip);
		} finally {
			await rm(f.root, { recursive: true, force: true });
		}
	}, 20_000);
	it('detects true divergence without modifying either remote', async () => {
		const f = await fixture();
		try {
			await git(f.workA, 'push', f.b, 'main');
			await git(f.root, 'clone', f.b, f.workB);
			await git(f.workB, 'checkout', 'main');
			for (const work of [f.workB]) {
				await git(work, 'config', 'user.email', 'two-way@test.invalid');
				await git(work, 'config', 'user.name', 'Two Way');
			}
			const aTip = await commit(f.workA, 'a', 'A');
			await git(f.workA, 'push', 'a', 'main');
			const bTip = await commit(f.workB, 'b', 'B');
			await git(f.workB, 'push', 'origin', 'main');
			const baseline = new Map([[refName('refs/heads/main'), { a: oid(f.base), b: oid(f.base) }]]);
			const result = await executeTwoWay(f.transport, {
				...f.request,
				runId: 'diverged',
				baselines: baseline,
				initialized: true,
				initialMode: 'require-equality'
			});
			expect(result.state).toBe('conflicted');
			expect(await git(f.root, '--git-dir', f.a, 'rev-parse', 'refs/heads/main')).toBe(aTip);
			expect(await git(f.root, '--git-dir', f.b, 'rev-parse', 'refs/heads/main')).toBe(bTip);
			const resolved = await executeTwoWay(f.transport, {
				...f.request,
				runId: 'keep-both',
				baselines: baseline,
				initialized: true,
				initialMode: 'require-equality',
				resolutions: new Map([
					[
						refName('refs/heads/main'),
						{ kind: 'keep-both', winner: 'A', newRef: refName('refs/heads/preserved-b') }
					]
				])
			});
			expect(resolved.state).toBe('succeeded');
			for (const remote of [f.a, f.b]) {
				expect(await git(f.root, '--git-dir', remote, 'rev-parse', 'refs/heads/main')).toBe(aTip);
				expect(await git(f.root, '--git-dir', remote, 'rev-parse', 'refs/heads/preserved-b')).toBe(
					bTip
				);
			}
		} finally {
			await rm(f.root, { recursive: true, force: true });
		}
	}, 20_000);
	it('converges compatible changes on both sides to the descendant tip', async () => {
		const f = await fixture();
		try {
			await git(f.workA, 'push', f.b, 'main');
			const aTip = await commit(f.workA, 'a-descendant', 'A descendant');
			await git(f.workA, 'push', 'a', 'main');
			await git(f.root, 'clone', f.b, f.workB);
			await git(f.workB, 'checkout', 'main');
			await git(f.workB, 'config', 'user.email', 'two-way@test.invalid');
			await git(f.workB, 'config', 'user.name', 'Two Way');
			await git(f.workB, 'fetch', f.a, 'main');
			await git(f.workB, 'reset', '--hard', aTip);
			const bTip = await commit(f.workB, 'b-descendant', 'B descendant');
			await git(f.workB, 'push', 'origin', 'main');
			const result = await executeTwoWay(f.transport, {
				...f.request,
				runId: 'descendant',
				baselines: new Map([[refName('refs/heads/main'), { a: oid(f.base), b: oid(f.base) }]]),
				initialized: true,
				initialMode: 'require-equality'
			});
			expect(result.state).toBe('succeeded');
			expect(await git(f.root, '--git-dir', f.a, 'rev-parse', 'refs/heads/main')).toBe(bTip);
		} finally {
			await rm(f.root, { recursive: true, force: true });
		}
	}, 20_000);
});
