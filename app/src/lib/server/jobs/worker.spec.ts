import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDatabase } from '../persistence/database';
import { StepHandlerRegistry } from './handlers';
import { JobQueue } from './queue';
import { runWorker } from './worker';
let db: SqliteDatabase | undefined;
afterEach(() => db?.close());
describe('worker shutdown', () => {
	it('stops new claims but finalizes the current bounded side effect', async () => {
		db = openDatabase(':memory:');
		db.prepare(
			"INSERT INTO users(id,email,password_hash,role,created_at)VALUES('owner','worker@test.invalid','h','admin',0)"
		).run();
		const queue = new JobQueue(db);
		const runId = queue.enqueue({
			ownerId: 'owner',
			kind: 'sync',
			trigger: 'manual',
			idempotencyKey: 'shutdown',
			steps: [{ name: 'non-interruptible-push' }]
		});
		const shutdown = new AbortController();
		const handlers = new StepHandlerRegistry();
		handlers.register('non-interruptible-push', async () => {
			shutdown.abort();
			return { remoteVerified: true };
		});
		await runWorker(queue, handlers, 'worker-shutdown', shutdown.signal);
		expect(db.prepare('SELECT state FROM runs WHERE id=?').get(runId)).toEqual({
			state: 'succeeded'
		});
		expect(
			db
				.prepare('SELECT stopped_at IS NOT NULL stopped FROM worker_heartbeats WHERE worker_id=?')
				.get('worker-shutdown')
		).toEqual({ stopped: 1 });
	});
});
