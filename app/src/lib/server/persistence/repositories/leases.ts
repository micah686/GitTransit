import type { SqliteDatabase } from '../database';
import { transaction } from '../database';

export interface LeaseClaim {
	resourceType: string;
	resourceId: string;
	workerId: string;
	fencingToken: number;
	expiresAt: number;
}

function dbNow(db: SqliteDatabase): number {
	return (
		db
			.prepare("SELECT CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AS now")
			.get() as { now: number }
	).now;
}

export class LeaseRepository {
	constructor(private readonly db: SqliteDatabase) {}

	acquire(
		resourceType: string,
		resourceId: string,
		workerId: string,
		leaseMs: number
	): LeaseClaim | null {
		return transaction(this.db, () => {
			const now = dbNow(this.db);
			const current = this.db
				.prepare(
					'SELECT worker_id,fencing_token,expires_at FROM leases WHERE resource_type=? AND resource_id=?'
				)
				.get(resourceType, resourceId) as
				{ worker_id: string; fencing_token: number; expires_at: number } | undefined;
			if (current && current.expires_at > now && current.worker_id !== workerId) return null;
			const fencingToken = (current?.fencing_token ?? 0) + 1;
			const expiresAt = now + leaseMs;
			this.db
				.prepare(
					`INSERT INTO leases(resource_type,resource_id,worker_id,fencing_token,expires_at,heartbeat_at)
			 VALUES (?,?,?,?,?,?) ON CONFLICT(resource_type,resource_id) DO UPDATE SET worker_id=excluded.worker_id,
			 fencing_token=excluded.fencing_token,expires_at=excluded.expires_at,heartbeat_at=excluded.heartbeat_at`
				)
				.run(resourceType, resourceId, workerId, fencingToken, expiresAt, now);
			return { resourceType, resourceId, workerId, fencingToken, expiresAt };
		});
	}

	heartbeat(claim: LeaseClaim, leaseMs: number): boolean {
		const now = dbNow(this.db);
		return (
			this.db
				.prepare(
					`UPDATE leases SET heartbeat_at=?,expires_at=? WHERE resource_type=? AND resource_id=?
		 AND worker_id=? AND fencing_token=? AND expires_at>?`
				)
				.run(
					now,
					now + leaseMs,
					claim.resourceType,
					claim.resourceId,
					claim.workerId,
					claim.fencingToken,
					now
				).changes === 1
		);
	}

	release(claim: LeaseClaim): boolean {
		return (
			this.db
				.prepare(
					`DELETE FROM leases WHERE resource_type=? AND resource_id=? AND worker_id=? AND fencing_token=?`
				)
				.run(claim.resourceType, claim.resourceId, claim.workerId, claim.fencingToken).changes === 1
		);
	}
}
