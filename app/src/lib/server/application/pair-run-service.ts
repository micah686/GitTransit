import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '../persistence/database';
import { database } from '../persistence/database';
import { JobQueue } from '../jobs/queue';
import type { SchedulePolicy } from '../domain/types';
import { nextSchedule } from './pair-service';
import { LeaseRepository } from '../persistence/repositories/leases';

interface RunnableRoute {
	id: string;
	side_b_repository_id: string | null;
}

export class PairRunService {
	private readonly queue: JobQueue;
	constructor(private readonly db: SqliteDatabase) {
		this.queue = new JobQueue(db);
	}

	enqueue(
		ownerId: string,
		pairId: string,
		trigger: 'manual' | 'schedule' = 'manual'
	): readonly string[] {
		const pair = this.db
			.prepare(
				`SELECT state,direction,schedule_policy_json,selection_policy_json FROM mirror_pairs WHERE id=? AND user_id=?`
			)
			.get(pairId, ownerId) as
			| {
					state: string;
					direction: string;
					schedule_policy_json: string;
					selection_policy_json: string;
			  }
			| undefined;
		if (!pair) throw new Error('Pair not found.');
		if (pair.state === 'paused') throw new Error('Resume this pair before running it.');
		if (pair.direction !== 'one-way')
			throw new Error('Two-way execution is introduced in Phase 7.');
		const policy = JSON.parse(pair.schedule_policy_json) as SchedulePolicy;
		const selection = JSON.parse(pair.selection_policy_json) as {
			extensions?: { autoProvision?: boolean };
		};
		const active = (
			this.db
				.prepare(
					`SELECT COUNT(*) count FROM runs WHERE pair_id=? AND user_id=? AND state IN ('queued','running')`
				)
				.get(pairId, ownerId) as { count: number }
		).count;
		if (active) throw new Error('This pair already has active work.');
		const routes = this.db
			.prepare(
				`SELECT id,side_b_repository_id FROM repository_routes WHERE pair_id=? AND user_id=? AND status NOT IN ('ignored','archived','blocked') ORDER BY updated_at LIMIT ?`
			)
			.all(pairId, ownerId, policy.batchSize) as RunnableRoute[];
		const runnable = routes.filter(
			(route) => route.side_b_repository_id || selection.extensions?.autoProvision
		);
		return runnable.map((route, index) =>
			this.queue.enqueue({
				ownerId,
				pairId,
				routeId: route.id,
				kind: 'sync',
				trigger,
				idempotencyKey: `${trigger}:${pairId}:${route.id}:${randomUUID()}`,
				priority: -index,
				steps: [
					...(route.side_b_repository_id
						? [{ name: 'reconcile-endpoint', routeId: route.id, maxAttempts: policy.retryAttempts }]
						: [{ name: 'provision-target', routeId: route.id, maxAttempts: policy.retryAttempts }]),
					{ name: 'sync-one-way', routeId: route.id, maxAttempts: policy.retryAttempts }
				]
			})
		);
	}

	setState(ownerId: string, pairId: string, state: 'enabled' | 'paused'): boolean {
		return (
			this.db
				.prepare(
					`UPDATE mirror_pairs SET state=?,version=version+1,updated_at=? WHERE id=? AND user_id=? AND validation_status='valid'`
				)
				.run(state, Date.now(), pairId, ownerId).changes === 1
		);
	}

	enqueueDue(now = Date.now(), schedulerId = 'scheduler-default'): number {
		const leadership = new LeaseRepository(this.db).acquire(
			'scheduler',
			'global',
			schedulerId,
			60_000
		);
		if (!leadership) return 0;
		const due = this.db
			.prepare(
				`SELECT id,user_id,schedule_policy_json FROM mirror_pairs p WHERE state='enabled' AND next_run_at<=? AND NOT EXISTS (SELECT 1 FROM runs r WHERE r.pair_id=p.id AND r.state IN ('queued','running')) ORDER BY next_run_at LIMIT 20`
			)
			.all(now) as Array<{ id: string; user_id: string; schedule_policy_json: string }>;
		let count = 0;
		for (const pair of due) {
			const policy = JSON.parse(pair.schedule_policy_json) as SchedulePolicy;
			const advanced = this.db
				.prepare('UPDATE mirror_pairs SET next_run_at=?,updated_at=? WHERE id=? AND next_run_at<=?')
				.run(nextSchedule(policy, new Date(now)), now, pair.id, now);
			if (advanced.changes !== 1) continue;
			try {
				this.enqueue(pair.user_id, pair.id, 'schedule');
				count += 1;
			} catch {
				/* another scheduler or empty inventory safely won */
			}
		}
		return count;
	}
}

let instance: PairRunService | undefined;
export function pairRunService(): PairRunService {
	instance ??= new PairRunService(database());
	return instance;
}
