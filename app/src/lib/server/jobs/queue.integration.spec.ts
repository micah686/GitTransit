import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDatabase } from '$lib/server/persistence/database';
import { JobQueue } from './queue';

let databases: SqliteDatabase[] = [];
let directory: string | undefined;

async function queues(): Promise<[JobQueue, JobQueue]> {
	directory = await mkdtemp(join(tmpdir(), 'gittransit-queue-'));
	const filename = join(directory, 'queue.sqlite');
	const first = openDatabase(filename);
	const second = openDatabase(filename);
	databases = [first, second];
	first
		.prepare(
			"INSERT INTO users (id,email,password_hash,role,created_at) VALUES ('owner','owner@example.test','hash','admin',0)"
		)
		.run();
	return [new JobQueue(first), new JobQueue(second)];
}

afterEach(async () => {
	for (const database of databases) database.close();
	databases = [];
	if (directory) await rm(directory, { recursive: true, force: true });
});

describe('JobQueue', () => {
	it('allows only one worker to own a step and fences stale finalization', async () => {
		const [first, second] = await queues();
		const runId = first.enqueue({
			ownerId: 'owner',
			kind: 'discover',
			trigger: 'manual',
			idempotencyKey: 'one',
			steps: [{ name: 'provider-contract-check' }]
		});
		const claim = first.claimNext('worker-a', 30_000);
		expect(claim).not.toBeNull();
		expect(second.claimNext('worker-b', 30_000)).toBeNull();
		expect(first.complete(claim!)).toBe(true);
		expect(databases[0]!.prepare('SELECT state FROM runs WHERE id=?').get(runId)).toEqual({
			state: 'succeeded'
		});
		expect(first.complete(claim!)).toBe(false);
	});

	it('recovers an expired step for retry without recording false success', async () => {
		const [first, second] = await queues();
		const runId = first.enqueue({
			ownerId: 'owner',
			kind: 'sync',
			trigger: 'manual',
			idempotencyKey: 'recovery',
			steps: [{ name: 'provider-contract-check' }]
		});
		const stale = first.claimNext('worker-stale', -1);
		expect(stale).not.toBeNull();
		expect(second.recoverExpired()).toBe(1);
		expect(first.complete(stale!)).toBe(false);
		expect(
			databases[0]!.prepare('SELECT state,safe_error_code FROM runs WHERE id=?').get(runId)
		).toEqual({
			state: 'queued',
			safe_error_code: 'WORKER_INTERRUPTED'
		});
		expect(second.claimNext('worker-current', 30_000)?.fencingToken).toBe(2);
	});

	it('deduplicates enqueue operations by owner and idempotency key', async () => {
		const [queue] = await queues();
		const input = {
			ownerId: 'owner',
			kind: 'cleanup' as const,
			trigger: 'manual' as const,
			idempotencyKey: 'same',
			steps: []
		};
		expect(queue.enqueue(input)).toBe(queue.enqueue(input));
	});

	it('runs ordered steps and finishes cooperative cancellation as cancelled', async () => {
		const [first, second] = await queues();
		const runId = first.enqueue({
			ownerId: 'owner',
			kind: 'sync',
			trigger: 'manual',
			idempotencyKey: 'cancel',
			steps: [{ name: 'first' }, { name: 'second' }]
		});
		const active = first.claimNext('worker-a', 30_000);
		expect(active?.name).toBe('first');
		expect(second.claimNext('worker-b', 30_000)).toBeNull();
		expect(first.requestCancellation('owner', runId)).toBe(true);
		expect(first.complete(active!)).toBe(true);
		expect(databases[0]!.prepare('SELECT state FROM runs WHERE id=?').get(runId)).toEqual({
			state: 'cancelled'
		});
	});
});
