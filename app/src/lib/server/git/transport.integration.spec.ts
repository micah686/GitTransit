import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { entityId } from '../domain/types';
import { executeOneWay } from './one-way';
import { ControlledGitTransport } from './transport';

const execute = promisify(execFile);
async function git(cwd: string, ...args: string[]): Promise<string> {
	return (await execute('git', args, { cwd })).stdout.trim();
}

async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'gittransit-transport-'));
	const a = join(root, 'a.git');
	const b = join(root, 'b.git');
	const work = join(root, 'work');
	await git(root, 'init', '--bare', a);
	await git(root, 'init', '--bare', b);
	await git(root, 'init', '-b', 'main', work);
	await git(work, 'config', 'user.email', 'transport@gittransit.invalid');
	await git(work, 'config', 'user.name', 'GitTransit Transport');
	await import('node:fs/promises').then(({ writeFile }) =>
		writeFile(join(work, 'file.txt'), 'one')
	);
	await git(work, 'add', 'file.txt');
	await git(work, 'commit', '-m', 'one');
	await git(work, 'push', a, 'refs/heads/main:refs/heads/main');
	return { root, a, b, work };
}

describe('controlled Git transport', () => {
	it('mirrors explicit refs and verifies the destination without push --mirror', async () => {
		const f = await fixture();
		try {
			const transport = new ControlledGitTransport({
				workspaceRoot: join(f.root, 'workspace'),
				artifactRoot: join(f.root, 'artifacts')
			});
			const endpoint = (value: string) => ({
				url: pathToFileURL(value),
				credentialId: null,
				stableIdentity: value
			});
			const result = await executeOneWay(transport, {
				routeId: entityId('route-1'),
				runId: 'run-1',
				endpointA: endpoint(f.a),
				endpointB: endpoint(f.b),
				refs: { includes: [], excludes: [], targetOnly: 'preserve' },
				safety: { strategy: 'fast-forward-only', requireBackup: false },
				lfs: 'off',
				capabilityGeneration: 1,
				policyGeneration: 1,
				assertLeaseCurrent: () => true
			});
			expect(result.state).toBe('succeeded');
			expect(await git(f.root, '--git-dir', f.b, 'rev-parse', 'refs/heads/main')).toBe(
				await git(f.root, '--git-dir', f.a, 'rev-parse', 'refs/heads/main')
			);
			await import('node:fs/promises').then(({ writeFile }) =>
				writeFile(join(f.work, 'file.txt'), 'fast-forward')
			);
			await git(f.work, 'add', 'file.txt');
			await git(f.work, 'commit', '-m', 'fast-forward');
			await git(f.work, 'push', f.a, 'refs/heads/main:refs/heads/main');
			const fastForward = await executeOneWay(transport, {
				routeId: entityId('route-1'),
				runId: 'run-2',
				endpointA: endpoint(f.a),
				endpointB: endpoint(f.b),
				refs: { includes: [], excludes: [], targetOnly: 'preserve' },
				safety: { strategy: 'fast-forward-only', requireBackup: false },
				lfs: 'off',
				capabilityGeneration: 1,
				policyGeneration: 1,
				assertLeaseCurrent: () => true
			});
			expect(fastForward.plan.actions).toContainEqual(
				expect.objectContaining({ kind: 'fast-forward' })
			);
		} finally {
			await rm(f.root, { recursive: true, force: true });
		}
	}, 20_000);

	it('backs up and applies force rewrites and target-only deletions', async () => {
		const f = await fixture();
		try {
			await git(f.work, 'push', f.b, 'refs/heads/main:refs/heads/main');
			await git(f.work, 'checkout', '--orphan', 'replacement');
			await import('node:fs/promises').then(({ writeFile }) =>
				writeFile(join(f.work, 'file.txt'), 'replacement')
			);
			await git(f.work, 'add', 'file.txt');
			await git(f.work, 'commit', '-m', 'replacement');
			await git(f.work, 'push', '--force', f.a, 'HEAD:refs/heads/main');
			await git(f.work, 'push', f.b, 'HEAD:refs/heads/target-only');
			const transport = new ControlledGitTransport({
				workspaceRoot: join(f.root, 'workspace'),
				artifactRoot: join(f.root, 'artifacts')
			});
			const endpoint = (value: string) => ({
				url: pathToFileURL(value),
				credentialId: null,
				stableIdentity: value
			});
			const result = await executeOneWay(transport, {
				routeId: entityId('route-destructive'),
				runId: 'run-destructive',
				endpointA: endpoint(f.a),
				endpointB: endpoint(f.b),
				refs: { includes: [], excludes: [], targetOnly: 'delete-with-approval' },
				safety: { strategy: 'backup-and-apply', requireBackup: true },
				lfs: 'off',
				capabilityGeneration: 1,
				policyGeneration: 1,
				assertLeaseCurrent: () => true
			});
			expect(result.state).toBe('succeeded');
			if (result.state !== 'succeeded') throw new Error('expected success');
			expect(result.artifact?.digest).toMatch(/^[0-9a-f]{64}$/u);
			expect(result.plan.actions).toContainEqual(expect.objectContaining({ kind: 'force-update' }));
			expect(result.plan.actions).toContainEqual(expect.objectContaining({ kind: 'delete' }));
			await expect(
				git(f.root, '--git-dir', f.b, 'rev-parse', 'refs/heads/target-only')
			).rejects.toThrow();
		} finally {
			await rm(f.root, { recursive: true, force: true });
		}
	}, 20_000);

	it('reports whether the optional Git LFS binary is available', async () => {
		const root = await mkdtemp(join(tmpdir(), 'gittransit-lfs-'));
		try {
			const transport = new ControlledGitTransport({
				workspaceRoot: join(root, 'workspace'),
				artifactRoot: join(root, 'artifacts')
			});
			expect(typeof (await transport.isLfsAvailable())).toBe('boolean');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('blocks a stale lease and creates a verified bundle before an allowed rewrite', async () => {
		const f = await fixture();
		try {
			await git(f.work, 'checkout', '--orphan', 'replacement');
			await import('node:fs/promises').then(({ writeFile }) =>
				writeFile(join(f.work, 'file.txt'), 'two')
			);
			await git(f.work, 'add', 'file.txt');
			await git(f.work, 'commit', '-m', 'replacement');
			await git(f.work, 'push', '--force', f.b, 'HEAD:refs/heads/main');
			await git(f.work, 'checkout', 'main');
			const transport = new ControlledGitTransport({
				workspaceRoot: join(f.root, 'workspace'),
				artifactRoot: join(f.root, 'artifacts')
			});
			const endpoint = (value: string) => ({
				url: pathToFileURL(value),
				credentialId: null,
				stableIdentity: value
			});
			const stale = await executeOneWay(transport, {
				routeId: entityId('route-stale'),
				runId: 'run-stale',
				endpointA: endpoint(f.a),
				endpointB: endpoint(f.b),
				refs: { includes: [], excludes: [], targetOnly: 'preserve' },
				safety: { strategy: 'backup-and-apply', requireBackup: true },
				lfs: 'off',
				capabilityGeneration: 1,
				policyGeneration: 1,
				assertLeaseCurrent: () => false
			});
			expect(stale).toBeUndefined();
		} catch (error) {
			expect(String(error)).toContain('stale');
			const bundles = await import('node:fs/promises').then(({ readdir }) =>
				readdir(join(f.root, 'artifacts'), { recursive: true })
			);
			const bundle = bundles.find((name) => String(name).endsWith('.bundle'));
			expect(bundle).toBeDefined();
			if (bundle)
				expect(
					(await readFile(join(f.root, 'artifacts', String(bundle)))).byteLength
				).toBeGreaterThan(0);
		} finally {
			await rm(f.root, { recursive: true, force: true });
		}
	}, 20_000);
});
