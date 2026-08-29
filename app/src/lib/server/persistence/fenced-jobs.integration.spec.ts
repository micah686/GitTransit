import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FencedJobStore } from './fenced-jobs';

interface WorkerEvent {
	readonly workerId: string;
	readonly claimed?: boolean;
	readonly finalized?: boolean;
	readonly token?: number;
}

interface WorkerRun {
	readonly firstEvent: Promise<WorkerEvent>;
	readonly completed: Promise<readonly WorkerEvent[]>;
}

function runWorker(database: string, worker: string, leaseMs: number, holdMs: number): WorkerRun {
	const script = resolve('scripts/spikes/sqlite-worker.mjs');
	let resolveFirst!: (event: WorkerEvent) => void;
	let rejectFirst!: (error: unknown) => void;
	const firstEvent = new Promise<WorkerEvent>((resolveEvent, rejectEvent) => {
		resolveFirst = resolveEvent;
		rejectFirst = rejectEvent;
	});
	const completed = new Promise<readonly WorkerEvent[]>((resolvePromise, reject) => {
		const child = spawn(
			process.execPath,
			[script, database, 'job-1', worker, String(leaseMs), String(holdMs)],
			{
				stdio: ['ignore', 'pipe', 'pipe']
			}
		);
		let stdout = '';
		let stderr = '';
		let firstResolved = false;
		child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
			stdout += chunk;
			const firstLine = stdout.split('\n')[0];
			if (!firstResolved && firstLine) {
				firstResolved = true;
				resolveFirst(JSON.parse(firstLine) as WorkerEvent);
			}
		});
		child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
		child.once('error', (error) => {
			rejectFirst(error);
			reject(error);
		});
		child.once('close', (code) => {
			if (code !== 0) {
				const error = new Error(stderr);
				rejectFirst(error);
				reject(error);
			} else
				resolvePromise(
					stdout
						.trim()
						.split('\n')
						.filter(Boolean)
						.map((line) => JSON.parse(line) as WorkerEvent)
				);
		});
	});
	return { firstEvent, completed };
}

describe('SQLite WAL claims and fencing spike', () => {
	it('prevents an expired worker from finalizing after a second process takes over', async () => {
		const root = await mkdtemp(join(tmpdir(), 'gittransit-fence-'));
		const database = join(root, 'jobs.sqlite');
		const store = new FencedJobStore(database);
		store.initialize();
		store.enqueue('job-1');
		store.close();
		try {
			const staleWorker = runWorker(database, 'worker-a', 250, 650);
			expect(await staleWorker.firstEvent).toEqual({
				workerId: 'worker-a',
				claimed: true,
				token: 1
			});
			await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
			const currentWorker = runWorker(database, 'worker-b', 1_000, 25);
			const [staleEvents, currentEvents] = await Promise.all([
				staleWorker.completed,
				currentWorker.completed
			]);
			expect(staleEvents).toEqual([
				{ workerId: 'worker-a', claimed: true, token: 1 },
				{ workerId: 'worker-a', finalized: false }
			]);
			expect(currentEvents).toEqual([
				{ workerId: 'worker-b', claimed: true, token: 2 },
				{ workerId: 'worker-b', finalized: true }
			]);
			const verification = new FencedJobStore(database);
			expect(verification.read('job-1')).toMatchObject({ state: 'succeeded', result: 'worker-b' });
			verification.close();
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}, 10_000);
});
