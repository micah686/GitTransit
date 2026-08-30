import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDatabase } from '../persistence/database';
import { ManualRouteRepository } from '../persistence/repositories/manual-routes';
import { JobQueue } from './queue';
let db: SqliteDatabase | undefined;
afterEach(() => db?.close());
function fixture() {
	db = openDatabase(':memory:');
	const owner = randomUUID(),
		a = randomUUID(),
		b = randomUUID(),
		now = Date.now();
	db.prepare('INSERT INTO users(id,email,password_hash,role,created_at)VALUES(?,?,?,?,?)').run(
		owner,
		'baseline@test.invalid',
		'h',
		'admin',
		now
	);
	const connection = db.prepare(
		`INSERT INTO connections(id,user_id,name,normalized_name,provider_id,base_url,capabilities_json,created_at,updated_at)VALUES(?,?,?,?, 'generic-git',?,'[]',?,?)`
	);
	connection.run(a, owner, 'A', 'a', 'https://a.test', now, now);
	connection.run(b, owner, 'B', 'b', 'https://b.test', now, now);
	const route = new ManualRouteRepository(db).create({
		ownerId: owner,
		name: 'Two way',
		connectionAId: a,
		connectionBId: b,
		sourceUrl: 'https://a.test/r.git',
		targetUrl: 'https://b.test/r.git',
		sourcePath: 'r',
		targetPath: 'r',
		content: {
			refs: { includes: [], excludes: [], targetOnly: 'preserve' },
			lfs: 'off',
			wiki: 'off'
		},
		safety: { strategy: 'fast-forward-only', requireBackup: false }
	});
	db.prepare("UPDATE mirror_pairs SET direction='two-way' WHERE id=?").run(route.pairId);
	const queue = new JobQueue(db);
	const runId = queue.enqueue({
		ownerId: owner,
		pairId: route.pairId,
		routeId: route.routeId,
		kind: 'sync',
		trigger: 'manual',
		idempotencyKey: randomUUID(),
		steps: [{ name: 'sync-two-way', routeId: route.routeId }]
	});
	return { owner, route, queue, runId };
}
describe('two-way baseline finalization', () => {
	it('atomically succeeds the run and advances equal baselines under the live fence', () => {
		const { route, queue, runId } = fixture();
		const claim = queue.claimNext('worker', 30_000)!;
		expect(db!.prepare('SELECT COUNT(*) count FROM ref_baselines').get()).toEqual({ count: 0 });
		expect(
			queue.completeTwoWay(claim, {
				generation: 1,
				baselineRefs: [{ ref: 'refs/heads/main', a: 'a'.repeat(40), b: 'a'.repeat(40) }]
			})
		).toBe(true);
		expect(db!.prepare('SELECT state FROM runs WHERE id=?').get(runId)).toEqual({
			state: 'succeeded'
		});
		expect(
			db!
				.prepare(
					'SELECT side_a_oid,side_b_oid,successful_run_id FROM ref_baselines WHERE route_id=?'
				)
				.get(route.routeId)
		).toEqual({ side_a_oid: 'a'.repeat(40), side_b_oid: 'a'.repeat(40), successful_run_id: runId });
		expect(queue.completeTwoWay(claim, { generation: 2, baselineRefs: [] })).toBe(false);
	});
	it('cannot advance a baseline from an expired claim', () => {
		const { route, queue } = fixture();
		const claim = queue.claimNext('stale', -1)!;
		queue.recoverExpired();
		expect(
			queue.completeTwoWay(claim, {
				generation: 1,
				baselineRefs: [{ ref: 'refs/heads/main', a: 'a', b: 'a' }]
			})
		).toBe(false);
		expect(
			db!.prepare('SELECT COUNT(*) count FROM ref_baselines WHERE route_id=?').get(route.routeId)
		).toEqual({ count: 0 });
	});
	it('honors cancellation without advancing a verified baseline', () => {
		const { owner, route, queue, runId } = fixture();
		const claim = queue.claimNext('cancelled', 30_000)!;
		expect(queue.requestCancellation(owner, runId)).toBe(true);
		expect(
			queue.completeTwoWay(claim, {
				generation: 1,
				baselineRefs: [{ ref: 'refs/heads/main', a: 'a', b: 'a' }]
			})
		).toBe(true);
		expect(db!.prepare('SELECT state FROM runs WHERE id=?').get(runId)).toEqual({
			state: 'cancelled'
		});
		expect(
			db!.prepare('SELECT COUNT(*) count FROM ref_baselines WHERE route_id=?').get(route.routeId)
		).toEqual({ count: 0 });
	});
});
