import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '$lib/server/persistence/database';
import { transaction } from '$lib/server/persistence/database';
import { appendEvent } from '$lib/server/events/store';

export type JobKind = 'discover' | 'preview' | 'provision' | 'sync' | 'cleanup' | 'metadata';
export interface StepDefinition {
	readonly name: string;
	readonly routeId?: string;
	readonly maxAttempts?: number;
	readonly checkpoint?: Readonly<Record<string, unknown>>;
}
export interface StepClaim {
	readonly stepId: string;
	readonly runId: string;
	readonly ownerId: string;
	readonly routeId: string | null;
	readonly name: string;
	readonly attempt: number;
	readonly workerId: string;
	readonly fencingToken: number;
	readonly leaseExpiresAt: number;
	readonly checkpoint: Readonly<Record<string, unknown>>;
}

interface ClaimRow {
	id: string;
	run_id: string;
	user_id: string;
	route_id: string | null;
	name: string;
	attempt: number;
	fencing_token: number;
	lease_expires_at: number;
	checkpoint_json: string;
}

function databaseNow(db: SqliteDatabase): number {
	return (
		db
			.prepare("SELECT CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AS now")
			.get() as { now: number }
	).now;
}

export class JobQueue {
	constructor(private readonly db: SqliteDatabase) {}

	heartbeatWorker(workerId: string, stopped = false): void {
		const now = databaseNow(this.db);
		this.db
			.prepare(
				`INSERT INTO worker_heartbeats(worker_id,started_at,heartbeat_at,stopped_at)
		 VALUES (?,?,?,?) ON CONFLICT(worker_id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at,
		 stopped_at=excluded.stopped_at`
			)
			.run(workerId, now, now, stopped ? now : null);
	}

	enqueue(input: {
		ownerId: string;
		kind: JobKind;
		trigger: 'manual' | 'schedule' | 'retry' | 'recovery' | 'conflict-resolution';
		idempotencyKey: string;
		pairId?: string;
		routeId?: string;
		steps: readonly StepDefinition[];
		priority?: number;
	}): string {
		return transaction(this.db, () => {
			const existing = this.db
				.prepare('SELECT id FROM runs WHERE user_id=? AND idempotency_key=?')
				.get(input.ownerId, input.idempotencyKey) as { id: string } | undefined;
			if (existing) return existing.id;
			const runId = randomUUID();
			const now = databaseNow(this.db);
			this.db
				.prepare(
					`INSERT INTO runs
			 (id,user_id,pair_id,route_id,trigger,kind,state,idempotency_key,priority,progress_total,requested_at)
			 VALUES (?,?,?,?,?,?,'queued',?,?,?,?)`
				)
				.run(
					runId,
					input.ownerId,
					input.pairId ?? null,
					input.routeId ?? null,
					input.trigger,
					input.kind,
					input.idempotencyKey,
					input.priority ?? 0,
					input.steps.length,
					now
				);
			const insertStep = this.db.prepare(`INSERT INTO run_steps
			 (id,run_id,route_id,step_order,name,max_attempts,state,next_attempt_at,checkpoint_json)
			 VALUES (?,?,?,?,?,?,'queued',?,?)`);
			input.steps.forEach((step, index) =>
				insertStep.run(
					randomUUID(),
					runId,
					step.routeId ?? input.routeId ?? null,
					index,
					step.name,
					step.maxAttempts ?? 3,
					now,
					JSON.stringify(step.checkpoint ?? {})
				)
			);
			appendEvent(
				this.db,
				input.ownerId,
				'run.queued',
				[runId],
				{ kind: input.kind, state: 'queued' },
				now
			);
			return runId;
		});
	}

	claimNext(workerId: string, leaseMs: number): StepClaim | null {
		return transaction(this.db, () => {
			const now = databaseNow(this.db);
			const candidate = this.db
				.prepare(
					`SELECT s.id FROM run_steps s JOIN runs r ON r.id=s.run_id
				 WHERE s.state='queued' AND s.next_attempt_at<=? AND r.cancellation_requested_at IS NULL
			 AND (r.pair_id IS NULL OR (SELECT COUNT(*) FROM run_steps busy JOIN runs busy_run ON busy_run.id=busy.run_id
			   WHERE busy.state='running' AND busy_run.pair_id=r.pair_id) < COALESCE((SELECT json_extract(p.schedule_policy_json,'$.routeConcurrency') FROM mirror_pairs p WHERE p.id=r.pair_id),1))
			 AND NOT EXISTS (SELECT 1 FROM run_steps prior WHERE prior.run_id=s.run_id
			   AND prior.step_order<s.step_order AND prior.state!='succeeded')
			 AND (s.route_id IS NULL OR NOT EXISTS (SELECT 1 FROM run_steps active
			   WHERE active.route_id=s.route_id AND active.state='running'))
			 ORDER BY r.priority DESC,r.requested_at,s.step_order LIMIT 1`
				)
				.get(now) as { id: string } | undefined;
			if (!candidate) return null;
			const expiresAt = now + leaseMs;
			const row = this.db
				.prepare(
					`UPDATE run_steps SET state='running',attempt=attempt+1,lease_owner=?,
			 lease_expires_at=?,fencing_token=fencing_token+1,started_at=COALESCE(started_at,?),heartbeat_at=?
			 WHERE id=? AND state='queued' RETURNING id,run_id,route_id,name,attempt,fencing_token,lease_expires_at,checkpoint_json`
				)
				.get(workerId, expiresAt, now, now, candidate.id) as Omit<ClaimRow, 'user_id'> | undefined;
			if (!row) return null;
			const run = this.db.prepare('SELECT user_id FROM runs WHERE id=?').get(row.run_id) as {
				user_id: string;
			};
			this.db
				.prepare(
					"UPDATE runs SET state='running',started_at=COALESCE(started_at,?),heartbeat_at=? WHERE id=?"
				)
				.run(now, now, row.run_id);
			return {
				stepId: row.id,
				runId: row.run_id,
				ownerId: run.user_id,
				routeId: row.route_id,
				name: row.name,
				attempt: row.attempt,
				workerId,
				fencingToken: row.fencing_token,
				leaseExpiresAt: row.lease_expires_at,
				checkpoint: JSON.parse(row.checkpoint_json) as Record<string, unknown>
			};
		});
	}

	heartbeat(claim: StepClaim, leaseMs: number): boolean {
		const now = databaseNow(this.db);
		return (
			this.db
				.prepare(
					`UPDATE run_steps SET heartbeat_at=?,lease_expires_at=? WHERE id=? AND state='running'
		 AND lease_owner=? AND fencing_token=? AND lease_expires_at>?`
				)
				.run(now, now + leaseMs, claim.stepId, claim.workerId, claim.fencingToken, now).changes ===
			1
		);
	}

	checkpoint(claim: StepClaim, value: Readonly<Record<string, unknown>>): boolean {
		const now = databaseNow(this.db);
		const warnings = Array.isArray(value.warnings)
			? value.warnings.filter((item): item is string => typeof item === 'string')
			: typeof value.warning === 'string'
				? [value.warning]
				: [];
		return (
			this.db
				.prepare(
					`UPDATE run_steps SET checkpoint_json=?,warning_json=?,heartbeat_at=? WHERE id=? AND state='running'
		 AND lease_owner=? AND fencing_token=? AND lease_expires_at>?`
				)
				.run(
					JSON.stringify(value),
					warnings.length ? JSON.stringify(warnings) : null,
					now,
					claim.stepId,
					claim.workerId,
					claim.fencingToken,
					now
				).changes === 1
		);
	}

	awaitApproval(claim: StepClaim, approvalId: string): boolean {
		return transaction(this.db, () => {
			const now = databaseNow(this.db);
			const updated = this.db
				.prepare(
					`UPDATE run_steps SET state='cancelled',completed_at=?,lease_owner=NULL,lease_expires_at=NULL,safe_error_code='AWAITING_APPROVAL' WHERE id=? AND state='running' AND lease_owner=? AND fencing_token=? AND lease_expires_at>?`
				)
				.run(now, claim.stepId, claim.workerId, claim.fencingToken, now);
			if (updated.changes !== 1) return false;
			this.db
				.prepare(
					"UPDATE runs SET state='awaiting-approval',safe_error_code='AWAITING_APPROVAL' WHERE id=? AND user_id=?"
				)
				.run(claim.runId, claim.ownerId);
			if (claim.routeId)
				this.db
					.prepare(
						"UPDATE repository_routes SET status='blocked',safe_error_code='AWAITING_APPROVAL',warning_summary='A destructive ref plan requires approval.',updated_at=? WHERE id=? AND user_id=?"
					)
					.run(now, claim.routeId, claim.ownerId);
			appendEvent(
				this.db,
				claim.ownerId,
				'run.awaiting-approval',
				[claim.runId, approvalId],
				{ state: 'awaiting-approval' },
				now
			);
			return true;
		});
	}

	terminalOutcome(
		claim: StepClaim,
		outcome: 'conflicted' | 'partial',
		resourceIds: readonly string[] = []
	): boolean {
		return transaction(this.db, () => {
			const now = databaseNow(this.db);
			const updated = this.db
				.prepare(
					`UPDATE run_steps SET state='failed',completed_at=?,lease_owner=NULL,lease_expires_at=NULL,safe_error_code=? WHERE id=? AND state='running' AND lease_owner=? AND fencing_token=? AND lease_expires_at>?`
				)
				.run(
					now,
					outcome === 'conflicted' ? 'REF_CONFLICT' : 'PARTIAL_WRITE',
					claim.stepId,
					claim.workerId,
					claim.fencingToken,
					now
				);
			if (updated.changes !== 1) return false;
			this.db
				.prepare(
					'UPDATE runs SET state=?,completed_at=?,safe_error_code=? WHERE id=? AND user_id=?'
				)
				.run(
					outcome,
					now,
					outcome === 'conflicted' ? 'REF_CONFLICT' : 'PARTIAL_WRITE',
					claim.runId,
					claim.ownerId
				);
			if (claim.routeId)
				this.db
					.prepare(
						'UPDATE repository_routes SET status=?,safe_error_code=?,warning_summary=?,updated_at=? WHERE id=? AND user_id=?'
					)
					.run(
						outcome === 'conflicted' ? 'conflict' : 'failed',
						outcome === 'conflicted' ? 'REF_CONFLICT' : 'PARTIAL_WRITE',
						outcome === 'conflicted'
							? 'Two-way ref changes require resolution.'
							: 'Only part of the two-way plan was applied; the next run will re-observe both remotes.',
						now,
						claim.routeId,
						claim.ownerId
					);
			appendEvent(
				this.db,
				claim.ownerId,
				`run.${outcome}`,
				[claim.runId, ...resourceIds],
				{ state: outcome },
				now
			);
			return true;
		});
	}

	completeTwoWay(claim: StepClaim, checkpoint: Readonly<Record<string, unknown>>): boolean {
		return transaction(this.db, () => {
			const refs = checkpoint.baselineRefs;
			if (!claim.routeId || !Array.isArray(refs) || typeof checkpoint.generation !== 'number')
				return false;
			const parsed: Array<{ ref: string; a: string | null; b: string | null }> = [];
			for (const value of refs) {
				if (!value || typeof value !== 'object') return false;
				const item = value as Record<string, unknown>;
				if (
					typeof item.ref !== 'string' ||
					(item.a !== null && typeof item.a !== 'string') ||
					(item.b !== null && typeof item.b !== 'string')
				)
					return false;
				parsed.push({ ref: item.ref, a: item.a as string | null, b: item.b as string | null });
			}
			const now = databaseNow(this.db);
			const run = this.db
				.prepare('SELECT cancellation_requested_at FROM runs WHERE id=? AND user_id=?')
				.get(claim.runId, claim.ownerId) as
				{ cancellation_requested_at: number | null } | undefined;
			if (!run) return false;
			if (run.cancellation_requested_at !== null) {
				const cancelled = this.db
					.prepare(
						`UPDATE run_steps SET state='cancelled',completed_at=?,lease_owner=NULL,lease_expires_at=NULL WHERE id=? AND state='running' AND lease_owner=? AND fencing_token=? AND lease_expires_at>?`
					)
					.run(now, claim.stepId, claim.workerId, claim.fencingToken, now);
				if (cancelled.changes !== 1) return false;
				this.db
					.prepare("UPDATE runs SET state='cancelled',completed_at=? WHERE id=? AND user_id=?")
					.run(now, claim.runId, claim.ownerId);
				appendEvent(
					this.db,
					claim.ownerId,
					'run.cancelled',
					[claim.runId],
					{ state: 'cancelled' },
					now
				);
				return true;
			}
			const route = this.db
				.prepare('SELECT generation FROM repository_routes WHERE id=? AND user_id=?')
				.get(claim.routeId, claim.ownerId) as { generation: number } | undefined;
			if (!route || route.generation !== checkpoint.generation) return false;
			const updated = this.db
				.prepare(
					`UPDATE run_steps SET state='succeeded',completed_at=?,lease_owner=NULL,lease_expires_at=NULL WHERE id=? AND state='running' AND lease_owner=? AND fencing_token=? AND lease_expires_at>?`
				)
				.run(now, claim.stepId, claim.workerId, claim.fencingToken, now);
			if (updated.changes !== 1) return false;
			const upsert = this.db.prepare(
				`INSERT INTO ref_baselines(route_id,ref_name,side_a_oid,side_b_oid,generation,successful_run_id,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(route_id,ref_name)DO UPDATE SET side_a_oid=excluded.side_a_oid,side_b_oid=excluded.side_b_oid,generation=excluded.generation,successful_run_id=excluded.successful_run_id,updated_at=excluded.updated_at`
			);
			for (const ref of parsed)
				upsert.run(
					claim.routeId,
					ref.ref,
					ref.a,
					ref.b,
					checkpoint.generation,
					claim.runId,
					now,
					now
				);
			this.db
				.prepare(
					`INSERT INTO route_reconciliation_state(route_id,initialized,generation,successful_run_id,updated_at)VALUES(?,1,?,?,?) ON CONFLICT(route_id)DO UPDATE SET initialized=1,generation=excluded.generation,successful_run_id=excluded.successful_run_id,updated_at=excluded.updated_at`
				)
				.run(claim.routeId, checkpoint.generation, claim.runId, now);
			if (typeof checkpoint.conflictId === 'string')
				this.db
					.prepare(
						"UPDATE conflicts SET state='resolved',resolution=?,resolved_by=?,resolved_at=? WHERE id=? AND user_id=? AND state='open'"
					)
					.run(
						typeof checkpoint.resolution === 'string' ? checkpoint.resolution : 'external',
						claim.ownerId,
						now,
						checkpoint.conflictId,
						claim.ownerId
					);
			this.db
				.prepare(
					'UPDATE runs SET progress_completed=progress_completed+1,heartbeat_at=? WHERE id=?'
				)
				.run(now, claim.runId);
			const active = (
				this.db
					.prepare(
						"SELECT COUNT(*) count FROM run_steps WHERE run_id=? AND state IN ('queued','running')"
					)
					.get(claim.runId) as { count: number }
			).count;
			if (active === 0) {
				this.db
					.prepare(
						"UPDATE runs SET state='succeeded',completed_at=?,safe_error_code=NULL WHERE id=? AND user_id=?"
					)
					.run(now, claim.runId, claim.ownerId);
				this.db
					.prepare(
						"UPDATE repository_routes SET status='synced',last_successful_run_id=?,safe_error_code=NULL,warning_summary=NULL,updated_at=? WHERE id=? AND user_id=?"
					)
					.run(claim.runId, now, claim.routeId, claim.ownerId);
				appendEvent(
					this.db,
					claim.ownerId,
					'run.succeeded',
					[claim.runId, claim.routeId],
					{ state: 'succeeded' },
					now
				);
			}
			return true;
		});
	}

	complete(claim: StepClaim): boolean {
		return transaction(this.db, () => {
			const now = databaseNow(this.db);
			const updated = this.db
				.prepare(
					`UPDATE run_steps SET state='succeeded',completed_at=?,lease_owner=NULL,
			 lease_expires_at=NULL WHERE id=? AND state='running' AND lease_owner=? AND fencing_token=? AND lease_expires_at>?`
				)
				.run(now, claim.stepId, claim.workerId, claim.fencingToken, now);
			if (updated.changes !== 1) return false;
			this.db
				.prepare(
					'UPDATE runs SET progress_completed=progress_completed+1,heartbeat_at=? WHERE id=?'
				)
				.run(now, claim.runId);
			const runState = this.db
				.prepare(
					`SELECT cancellation_requested_at,
			 (SELECT COUNT(*) FROM run_steps WHERE run_id=? AND state IN ('queued','running')) AS active
			 FROM runs WHERE id=?`
				)
				.get(claim.runId, claim.runId) as {
				cancellation_requested_at: number | null;
				active: number;
			};
			if (runState.active === 0 && runState.cancellation_requested_at !== null) {
				this.db
					.prepare("UPDATE runs SET state='cancelled',completed_at=? WHERE id=?")
					.run(now, claim.runId);
				appendEvent(
					this.db,
					claim.ownerId,
					'run.cancelled',
					[claim.runId],
					{ state: 'cancelled' },
					now
				);
			} else if (runState.active === 0) {
				this.db
					.prepare("UPDATE runs SET state='succeeded',completed_at=? WHERE id=?")
					.run(now, claim.runId);
				if (
					(claim.name === 'sync-one-way' ||
						claim.name === 'sync-wiki' ||
						claim.name === 'sync-metadata') &&
					claim.routeId
				) {
					const warningRows = this.db
						.prepare(
							`SELECT warning_json FROM run_steps WHERE run_id=? AND warning_json IS NOT NULL`
						)
						.all(claim.runId) as Array<{ warning_json: string }>;
					const warnings = warningRows.flatMap((row) => {
						const parsed = JSON.parse(row.warning_json) as unknown;
						return Array.isArray(parsed)
							? parsed.filter((item): item is string => typeof item === 'string')
							: [];
					});
					this.db
						.prepare(
							`UPDATE repository_routes SET status='synced',last_successful_run_id=?,
						 safe_error_code=NULL,warning_summary=?,updated_at=? WHERE id=? AND user_id=?`
						)
						.run(
							claim.runId,
							warnings.length ? [...new Set(warnings)].join(' ') : null,
							now,
							claim.routeId,
							claim.ownerId
						);
				}
				appendEvent(
					this.db,
					claim.ownerId,
					'run.succeeded',
					[claim.runId],
					{ state: 'succeeded' },
					now
				);
			} else
				appendEvent(
					this.db,
					claim.ownerId,
					'run.progress',
					[claim.runId, claim.stepId],
					{ state: 'running' },
					now
				);
			return true;
		});
	}

	failOrRetry(
		claim: StepClaim,
		errorCode: string,
		retryDelayMs: number
	): 'retry' | 'failed' | 'stale' {
		return transaction(this.db, () => {
			const now = databaseNow(this.db);
			const current = this.db
				.prepare(
					`SELECT attempt,max_attempts FROM run_steps WHERE id=? AND state='running'
			 AND lease_owner=? AND fencing_token=? AND lease_expires_at>?`
				)
				.get(claim.stepId, claim.workerId, claim.fencingToken, now) as
				{ attempt: number; max_attempts: number } | undefined;
			if (!current) return 'stale';
			if (current.attempt < current.max_attempts) {
				this.db
					.prepare(
						`UPDATE run_steps SET state='queued',next_attempt_at=?,safe_error_code=?,
				 lease_owner=NULL,lease_expires_at=NULL WHERE id=?`
					)
					.run(now + retryDelayMs, errorCode, claim.stepId);
				this.db
					.prepare("UPDATE runs SET state='queued',safe_error_code=? WHERE id=?")
					.run(errorCode, claim.runId);
				return 'retry';
			}
			this.db
				.prepare(
					`UPDATE run_steps SET state='failed',completed_at=?,safe_error_code=?,
			 lease_owner=NULL,lease_expires_at=NULL WHERE id=?`
				)
				.run(now, errorCode, claim.stepId);
			this.db
				.prepare("UPDATE runs SET state='failed',completed_at=?,safe_error_code=? WHERE id=?")
				.run(now, errorCode, claim.runId);
			if (claim.routeId)
				this.db
					.prepare(
						`UPDATE repository_routes SET status='failed',safe_error_code=?,
					 warning_summary=?,updated_at=? WHERE id=? AND user_id=?`
					)
					.run(
						errorCode,
						claim.name === 'sync-metadata' || claim.name === 'sync-wiki'
							? 'A required metadata component failed after Git synchronization.'
							: 'Synchronization failed.',
						now,
						claim.routeId,
						claim.ownerId
					);
			appendEvent(
				this.db,
				claim.ownerId,
				'run.failed',
				[claim.runId, claim.stepId],
				{ state: 'failed', errorCode },
				now
			);
			return 'failed';
		});
	}

	requestCancellation(ownerId: string, runId: string): boolean {
		return transaction(this.db, () => {
			const now = databaseNow(this.db);
			const result = this.db
				.prepare(
					`UPDATE runs SET cancellation_requested_at=? WHERE id=? AND user_id=?
			 AND state IN ('queued','running')`
				)
				.run(now, runId, ownerId);
			if (result.changes !== 1) return false;
			this.db
				.prepare(
					"UPDATE run_steps SET state='cancelled',completed_at=? WHERE run_id=? AND state='queued'"
				)
				.run(now, runId);
			const running = (
				this.db
					.prepare("SELECT COUNT(*) AS count FROM run_steps WHERE run_id=? AND state='running'")
					.get(runId) as { count: number }
			).count;
			if (running === 0)
				this.db
					.prepare("UPDATE runs SET state='cancelled',completed_at=? WHERE id=?")
					.run(now, runId);
			appendEvent(
				this.db,
				ownerId,
				'run.cancellation-requested',
				[runId],
				{ state: 'cancelling' },
				now
			);
			return true;
		});
	}

	recoverExpired(): number {
		return transaction(this.db, () => {
			const now = databaseNow(this.db);
			const expired = this.db
				.prepare(
					`SELECT s.id,s.run_id,r.user_id,s.attempt,s.max_attempts FROM run_steps s
			 JOIN runs r ON r.id=s.run_id WHERE s.state='running' AND s.lease_expires_at<=?`
				)
				.all(now) as Array<{
				id: string;
				run_id: string;
				user_id: string;
				attempt: number;
				max_attempts: number;
			}>;
			for (const step of expired) {
				const retry = step.attempt < step.max_attempts;
				this.db
					.prepare(
						`UPDATE run_steps SET state=?,next_attempt_at=?,lease_owner=NULL,lease_expires_at=NULL,
				 safe_error_code='WORKER_INTERRUPTED' WHERE id=?`
					)
					.run(retry ? 'queued' : 'interrupted', now, step.id);
				this.db
					.prepare(`UPDATE runs SET state=?,safe_error_code='WORKER_INTERRUPTED' WHERE id=?`)
					.run(retry ? 'queued' : 'interrupted', step.run_id);
				appendEvent(
					this.db,
					step.user_id,
					'run.interrupted',
					[step.run_id, step.id],
					{ recovered: retry },
					now
				);
			}
			return expired.length;
		});
	}
}
