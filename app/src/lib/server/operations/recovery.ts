import type { SqliteDatabase } from '../persistence/database';
import { database, transaction } from '../persistence/database';
import { JobQueue } from '../jobs/queue';
import { MaintenanceService } from './maintenance';
export interface RecoveryResult {
	expiredSteps: number;
	repairedRoutes: number;
	expiredApprovals: number;
	temporaryFiles: number;
}
export class RecoveryService {
	constructor(private readonly db: SqliteDatabase) {}
	async run(): Promise<RecoveryResult> {
		const expiredSteps = new JobQueue(this.db).recoverExpired();
		const now = Date.now();
		const repairedRoutes = transaction(
			this.db,
			() =>
				this.db
					.prepare(
						`UPDATE repository_routes SET status=CASE WHEN last_successful_run_id IS NULL THEN 'ready' ELSE 'synced' END,warning_summary='Recovered stale syncing projection.',updated_at=? WHERE status='syncing' AND NOT EXISTS(SELECT 1 FROM run_steps s WHERE s.route_id=repository_routes.id AND s.state='running' AND s.lease_expires_at>?)`
					)
					.run(now, now).changes
		);
		const expiredApprovals = this.db
			.prepare(
				"UPDATE destructive_plans SET state='expired' WHERE state IN ('pending','approved') AND expires_at<=?"
			)
			.run(now).changes;
		const temporaryFiles = await new MaintenanceService(this.db).cleanupTemporaryArtifacts(now);
		return { expiredSteps, repairedRoutes, expiredApprovals, temporaryFiles };
	}
}
let instance: RecoveryService | undefined;
export function recoveryService() {
	instance ??= new RecoveryService(database());
	return instance;
}
