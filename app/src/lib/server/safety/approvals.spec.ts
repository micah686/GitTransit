import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDatabase } from '../persistence/database';
import { ManualRouteRepository } from '../persistence/repositories/manual-routes';
import { JobQueue } from '../jobs/queue';
import { entityId, oid, refName, type ImmutableRefPlan } from '../domain/types';
import { ApprovalService, planDigest } from './approvals';
let db: SqliteDatabase | undefined;
afterEach(() => db?.close());
function fixture() {
	db = openDatabase(':memory:');
	const ownerId = randomUUID(),
		now = Date.now(),
		a = randomUUID(),
		b = randomUUID();
	db.prepare('INSERT INTO users(id,email,password_hash,role,created_at) VALUES(?,?,?,?,?)').run(
		ownerId,
		'approval@test.invalid',
		'hash',
		'admin',
		now
	);
	const insert = db.prepare(
		`INSERT INTO connections(id,user_id,name,normalized_name,provider_id,base_url,capabilities_json,created_at,updated_at)VALUES(?,?,?,?, 'generic-git',?,'["git:fetch","git:push"]',?,?)`
	);
	insert.run(a, ownerId, 'A', 'a', 'https://a.test', now, now);
	insert.run(b, ownerId, 'B', 'b', 'https://b.test', now, now);
	const route = new ManualRouteRepository(db).create({
		ownerId,
		name: 'Approval',
		connectionAId: a,
		connectionBId: b,
		sourceUrl: 'https://a.test/team/repo.git',
		targetUrl: 'https://b.test/team/repo.git',
		sourcePath: 'team/repo',
		targetPath: 'team/repo',
		content: {
			refs: { includes: [], excludes: [], targetOnly: 'preserve' },
			lfs: 'off',
			wiki: 'off'
		},
		safety: { strategy: 'approve-destructive', requireBackup: true }
	});
	const queue = new JobQueue(db);
	const runId = queue.enqueue({
		ownerId,
		pairId: route.pairId,
		routeId: route.routeId,
		kind: 'sync',
		trigger: 'manual',
		idempotencyKey: 'approval',
		steps: [{ name: 'sync-one-way', routeId: route.routeId }]
	});
	const claim = queue.claimNext('worker', 30_000)!;
	const plan: ImmutableRefPlan = {
		routeId: entityId(route.routeId),
		observedEndpointA: 'a',
		observedEndpointB: 'b',
		capabilityGeneration: 1,
		policyGeneration: 1,
		expectedA: new Map([[refName('refs/heads/main'), oid('a'.repeat(40))]]),
		expectedB: new Map([[refName('refs/heads/main'), oid('b'.repeat(40))]]),
		actions: [
			{
				kind: 'force-update',
				ref: refName('refs/heads/main'),
				oldOid: oid('b'.repeat(40)),
				newOid: oid('a'.repeat(40)),
				to: 'B'
			}
		]
	};
	return { ownerId, runId, claim, plan, queue };
}
describe('destructive approvals', () => {
	it('stores an immutable digest and resumes only its exact paused step', () => {
		const { ownerId, runId, claim, plan, queue } = fixture();
		const service = new ApprovalService(db!);
		const id = service.request(ownerId, runId, claim.stepId, claim.routeId!, plan);
		expect(queue.awaitApproval(claim, id)).toBe(true);
		expect(service.list(ownerId)[0]).toMatchObject({
			id,
			digest: planDigest(plan),
			state: 'pending'
		});
		expect(service.decide(ownerId, id, 'approved')).toBe(true);
		expect(service.approvedFor(ownerId, runId, claim.stepId)?.plan.actions).toEqual(plan.actions);
		expect(db!.prepare('SELECT state FROM run_steps WHERE id=?').get(claim.stepId)).toEqual({
			state: 'queued'
		});
		expect(service.decide(ownerId, id, 'approved')).toBe(false);
	});
	it('changes the digest when any observed OID changes', () => {
		const { plan } = fixture();
		const changed = {
			...plan,
			expectedB: new Map([[refName('refs/heads/main'), oid('c'.repeat(40))]])
		};
		expect(planDigest(changed)).not.toBe(planDigest(plan));
	});
});
