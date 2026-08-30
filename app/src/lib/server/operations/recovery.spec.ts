import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDatabase } from '../persistence/database';
import { JobQueue } from '../jobs/queue';
import { RecoveryService } from './recovery';
let db: SqliteDatabase | undefined;
afterEach(() => db?.close());
describe('startup recovery', () => {
	it('is repeatable and never records an expired external step as successful', async () => {
		db = openDatabase(':memory:');
		db.prepare(
			"INSERT INTO users(id,email,password_hash,role,created_at)VALUES('owner','o@test.invalid','h','admin',0)"
		).run();
		const queue = new JobQueue(db);
		const runId = queue.enqueue({
			ownerId: 'owner',
			kind: 'sync',
			trigger: 'manual',
			idempotencyKey: 'crash',
			steps: [{ name: 'sync-one-way' }]
		});
		const claim = queue.claimNext('crashed-worker', -1);
		expect(claim).not.toBeNull();
		const first = await new RecoveryService(db).run();
		expect(first.expiredSteps).toBe(1);
		expect(await new RecoveryService(db).run()).toMatchObject({
			expiredSteps: 0,
			repairedRoutes: 0
		});
		expect(db.prepare('SELECT state FROM runs WHERE id=?').get(runId)).toEqual({ state: 'queued' });
		expect(queue.complete(claim!)).toBe(false);
	});
	it('requeues crashes at every external-effect boundary', async () => {
		db = openDatabase(':memory:');
		db.prepare(
			"INSERT INTO users(id,email,password_hash,role,created_at)VALUES('owner','steps@test.invalid','h','admin',0)"
		).run();
		const queue = new JobQueue(db);
		const names = [
			'validate-endpoints',
			'provision-target',
			'observe-refs',
			'persist-plan',
			'create-backup',
			'push-refs',
			'transfer-lfs',
			'verify-refs'
		];
		for (const name of names) {
			queue.enqueue({
				ownerId: 'owner',
				kind: 'sync',
				trigger: 'recovery',
				idempotencyKey: name,
				steps: [{ name }]
			});
			expect(queue.claimNext(`worker-${name}`, -1)?.name).toBe(name);
		}
		expect((await new RecoveryService(db).run()).expiredSteps).toBe(names.length);
		expect(
			(
				db.prepare("SELECT COUNT(*) count FROM run_steps WHERE state='queued'").get() as {
					count: number;
				}
			).count
		).toBe(names.length);
	});
});
