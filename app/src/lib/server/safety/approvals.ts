import { createHash, randomUUID } from 'node:crypto';
import type { ImmutableRefPlan, Oid, RefAction, RefName } from '../domain/types';
import { entityId, oid, refName } from '../domain/types';
import type { SqliteDatabase } from '../persistence/database';
import { database, transaction } from '../persistence/database';
import { appendEvent } from '../events/store';

interface StoredPlan {
	routeId: string;
	observedEndpointA: string;
	observedEndpointB: string;
	capabilityGeneration: number;
	policyGeneration: number;
	expectedA: readonly (readonly [string, string])[];
	expectedB: readonly (readonly [string, string])[];
	actions: readonly RefAction[];
}
function stored(plan: ImmutableRefPlan): StoredPlan {
	return {
		routeId: plan.routeId,
		observedEndpointA: plan.observedEndpointA,
		observedEndpointB: plan.observedEndpointB,
		capabilityGeneration: plan.capabilityGeneration,
		policyGeneration: plan.policyGeneration,
		expectedA: [...plan.expectedA].sort(([a], [b]) => a.localeCompare(b)),
		expectedB: [...plan.expectedB].sort(([a], [b]) => a.localeCompare(b)),
		actions: plan.actions
	};
}
export function planDigest(plan: ImmutableRefPlan): string {
	return createHash('sha256')
		.update(JSON.stringify(stored(plan)))
		.digest('hex');
}
function hydrate(value: StoredPlan): ImmutableRefPlan {
	return {
		routeId: entityId(value.routeId),
		observedEndpointA: value.observedEndpointA,
		observedEndpointB: value.observedEndpointB,
		capabilityGeneration: value.capabilityGeneration,
		policyGeneration: value.policyGeneration,
		expectedA: new Map(
			value.expectedA.map(([name, value]) => [refName(name), oid(value)] as [RefName, Oid])
		),
		expectedB: new Map(
			value.expectedB.map(([name, value]) => [refName(name), oid(value)] as [RefName, Oid])
		),
		actions: value.actions
	};
}

export interface ApprovalSummary {
	id: string;
	routeId: string;
	runId: string;
	state: string;
	digest: string;
	createdAt: number;
	expiresAt: number;
	pairName: string;
	sourcePath: string;
	targetPath: string;
	actions: readonly RefAction[];
}
export class ApprovalService {
	constructor(private readonly db: SqliteDatabase) {}
	request(
		ownerId: string,
		runId: string,
		stepId: string,
		routeId: string,
		plan: ImmutableRefPlan,
		ttlMs = 86_400_000
	): string {
		return transaction(this.db, () => {
			const now = Date.now();
			const digest = planDigest(plan);
			const existing = this.db
				.prepare(
					'SELECT id,plan_digest,state FROM destructive_plans WHERE run_id=? AND step_id=? AND user_id=?'
				)
				.get(runId, stepId, ownerId) as
				{ id: string; plan_digest: string; state: string } | undefined;
			if (existing) {
				if (existing.plan_digest !== digest || existing.state !== 'pending')
					this.db
						.prepare(
							"UPDATE destructive_plans SET plan_digest=?,plan_json=?,state='pending',created_at=?,expires_at=?,decided_by=NULL,decided_at=NULL WHERE id=?"
						)
						.run(digest, JSON.stringify(stored(plan)), now, now + ttlMs, existing.id);
				return existing.id;
			}
			const id = randomUUID();
			this.db
				.prepare(
					`INSERT INTO destructive_plans(id,user_id,route_id,run_id,step_id,plan_digest,plan_json,state,created_at,expires_at) VALUES(?,?,?,?,?,?,?,'pending',?,?)`
				)
				.run(
					id,
					ownerId,
					routeId,
					runId,
					stepId,
					digest,
					JSON.stringify(stored(plan)),
					now,
					now + ttlMs
				);
			appendEvent(
				this.db,
				ownerId,
				'approval.requested',
				[id, runId, routeId],
				{ state: 'pending', digest },
				now
			);
			return id;
		});
	}
	list(ownerId: string, state = 'pending'): readonly ApprovalSummary[] {
		return (
			this.db
				.prepare(
					`SELECT d.id,d.route_id routeId,d.run_id runId,d.state,d.plan_digest digest,d.plan_json planJson,d.created_at createdAt,d.expires_at expiresAt,p.name pairName,a.canonical_full_path sourcePath,b.canonical_full_path targetPath FROM destructive_plans d JOIN repository_routes r ON r.id=d.route_id AND r.user_id=d.user_id JOIN mirror_pairs p ON p.id=r.pair_id JOIN route_endpoints a ON a.route_id=r.id AND a.side='A' JOIN route_endpoints b ON b.route_id=r.id AND b.side='B' WHERE d.user_id=? AND (? IS NULL OR d.state=?) ORDER BY d.created_at DESC`
				)
				.all(ownerId, state || null, state || null) as Array<Record<string, unknown>>
		).map((row) => ({
			...row,
			actions: (JSON.parse(String(row.planJson)) as StoredPlan).actions
		})) as unknown as ApprovalSummary[];
	}
	approvedFor(
		ownerId: string,
		runId: string,
		stepId: string
	): { id: string; plan: ImmutableRefPlan } | null {
		const row = this.db
			.prepare(
				"SELECT id,plan_json FROM destructive_plans WHERE user_id=? AND run_id=? AND step_id=? AND state='approved' AND expires_at>?"
			)
			.get(ownerId, runId, stepId, Date.now()) as { id: string; plan_json: string } | undefined;
		return row ? { id: row.id, plan: hydrate(JSON.parse(row.plan_json) as StoredPlan) } : null;
	}
	decide(ownerId: string, id: string, decision: 'approved' | 'rejected'): boolean {
		return transaction(this.db, () => {
			const now = Date.now();
			const row = this.db
				.prepare(
					"SELECT run_id,step_id,route_id FROM destructive_plans WHERE id=? AND user_id=? AND state='pending' AND expires_at>?"
				)
				.get(id, ownerId, now) as { run_id: string; step_id: string; route_id: string } | undefined;
			if (!row) return false;
			this.db
				.prepare('UPDATE destructive_plans SET state=?,decided_by=?,decided_at=? WHERE id=?')
				.run(decision, ownerId, now, id);
			if (decision === 'approved') {
				this.db
					.prepare(
						"UPDATE run_steps SET state='queued',next_attempt_at=?,completed_at=NULL,safe_error_code=NULL WHERE id=? AND run_id=? AND state='cancelled'"
					)
					.run(now, row.step_id, row.run_id);
				this.db
					.prepare(
						"UPDATE runs SET state='queued',completed_at=NULL,safe_error_code=NULL WHERE id=? AND user_id=? AND state='awaiting-approval'"
					)
					.run(row.run_id, ownerId);
				this.db
					.prepare(
						"UPDATE repository_routes SET status='ready',updated_at=? WHERE id=? AND user_id=?"
					)
					.run(now, row.route_id, ownerId);
			} else {
				this.db
					.prepare("UPDATE runs SET state='cancelled',completed_at=? WHERE id=? AND user_id=?")
					.run(now, row.run_id, ownerId);
			}
			appendEvent(
				this.db,
				ownerId,
				`approval.${decision}`,
				[id, row.run_id, row.route_id],
				{ state: decision },
				now
			);
			return true;
		});
	}
	markApplied(ownerId: string, id: string): void {
		this.db
			.prepare(
				"UPDATE destructive_plans SET state='applied',applied_at=? WHERE id=? AND user_id=? AND state='approved'"
			)
			.run(Date.now(), id, ownerId);
	}
	invalidate(ownerId: string, id: string): void {
		this.db
			.prepare(
				"UPDATE destructive_plans SET state='invalidated' WHERE id=? AND user_id=? AND state='approved'"
			)
			.run(id, ownerId);
	}
}
let instance: ApprovalService | undefined;
export function approvalService() {
	instance ??= new ApprovalService(database());
	return instance;
}
