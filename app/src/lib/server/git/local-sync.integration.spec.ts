import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { planTwoWayRef } from '../domain/ref-plan';
import { oid, refName } from '../domain/types';

const execute = promisify(execFile);

async function git(cwd: string, ...args: readonly string[]): Promise<string> {
	const { stdout } = await execute('git', [...args], {
		cwd,
		env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
	});
	return stdout.trim();
}

async function commit(worktree: string, contents: string, message: string): Promise<string> {
	await execute('/bin/sh', ['-c', 'printf %s "$CONTENT" > tracked.txt'], {
		cwd: worktree,
		env: { ...process.env, CONTENT: contents }
	});
	await git(worktree, 'add', 'tracked.txt');
	await git(worktree, 'commit', '-m', message);
	return git(worktree, 'rev-parse', 'HEAD');
}

describe('local bare repository transport spike', () => {
	it('copies explicit refs, detects two-way divergence without writes, and rejects a stale lease', async () => {
		const root = await mkdtemp(join(tmpdir(), 'gittransit-sync-'));
		const remoteA = join(root, 'a.git');
		const remoteB = join(root, 'b.git');
		const workA = join(root, 'work-a');
		const workB = join(root, 'work-b');
		const observer = join(root, 'observer');
		try {
			await git(root, 'init', '--bare', remoteA);
			await git(root, 'init', '--bare', remoteB);
			await git(root, 'init', '-b', 'main', workA);
			await git(workA, 'config', 'user.email', 'spike@gittransit.invalid');
			await git(workA, 'config', 'user.name', 'GitTransit Spike');
			const baseline = await commit(workA, 'baseline', 'baseline');
			await git(workA, 'remote', 'add', 'a', remoteA);
			await git(workA, 'push', 'a', 'refs/heads/main:refs/heads/main');

			// Explicit managed refspec: deliberately not --mirror.
			await git(workA, 'push', remoteB, 'refs/heads/main:refs/heads/main');
			expect(await git(root, '--git-dir', remoteB, 'rev-parse', 'refs/heads/main')).toBe(baseline);

			await git(root, 'clone', remoteB, workB);
			await git(workB, 'checkout', 'main');
			await git(workB, 'config', 'user.email', 'spike@gittransit.invalid');
			await git(workB, 'config', 'user.name', 'GitTransit Spike');
			const aTip = await commit(workA, 'side-a', 'side A');
			await git(workA, 'push', 'a', 'refs/heads/main:refs/heads/main');
			const bTip = await commit(workB, 'side-b', 'side B');
			await git(workB, 'push', 'origin', 'refs/heads/main:refs/heads/main');

			const beforeA = await git(root, '--git-dir', remoteA, 'rev-parse', 'refs/heads/main');
			const beforeB = await git(root, '--git-dir', remoteB, 'rev-parse', 'refs/heads/main');
			await git(root, 'init', '--bare', observer);
			await git(
				root,
				'--git-dir',
				observer,
				'fetch',
				remoteA,
				'refs/heads/main:refs/observe/a/main'
			);
			await git(
				root,
				'--git-dir',
				observer,
				'fetch',
				remoteB,
				'refs/heads/main:refs/observe/b/main'
			);
			const action = await planTwoWayRef(
				refName('refs/heads/main'),
				{ a: oid(baseline), b: oid(baseline) },
				oid(aTip),
				oid(bTip),
				async (older, newer) => {
					try {
						await git(root, '--git-dir', observer, 'merge-base', '--is-ancestor', older, newer);
						return true;
					} catch {
						return false;
					}
				}
			);
			expect(action).toMatchObject({ kind: 'conflict', reason: 'diverged' });
			expect(await git(root, '--git-dir', remoteA, 'rev-parse', 'refs/heads/main')).toBe(beforeA);
			expect(await git(root, '--git-dir', remoteB, 'rev-parse', 'refs/heads/main')).toBe(beforeB);

			await expect(
				git(
					root,
					'--git-dir',
					observer,
					'push',
					`--force-with-lease=refs/heads/main:${baseline}`,
					remoteB,
					`${aTip}:refs/heads/main`
				)
			).rejects.toThrow();
			expect(await git(root, '--git-dir', remoteB, 'rev-parse', 'refs/heads/main')).toBe(beforeB);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}, 20_000);
});
