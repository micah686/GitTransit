import { randomUUID } from 'node:crypto';
import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { SqliteDatabase } from '../persistence/database';
import { database, transaction } from '../persistence/database';
import { config } from '../config';

export interface CleanupResult {
	events: number;
	runs: number;
	observations: number;
	artifacts: number;
	artifactBytes: number;
	temporaryFiles: number;
	notificationDeliveries: number;
	dryRun: boolean;
}
export class MaintenanceService {
	constructor(private readonly db: SqliteDatabase) {}
	history(ownerId: string): readonly {
		id: string;
		kind: string;
		dryRun: boolean;
		result: CleanupResult;
		createdAt: number;
	}[] {
		return (
			this.db
				.prepare(
					`SELECT id,kind,dry_run,result_json,created_at FROM maintenance_runs
				 WHERE user_id=? ORDER BY created_at DESC LIMIT 20`
				)
				.all(ownerId) as Array<{
				id: string;
				kind: string;
				dry_run: number;
				result_json: string;
				created_at: number;
			}>
		).map((row) => ({
			id: row.id,
			kind: row.kind,
			dryRun: row.dry_run === 1,
			result: JSON.parse(row.result_json) as CleanupResult,
			createdAt: row.created_at
		}));
	}
	async cleanup(
		ownerId: string,
		options: {
			dryRun: boolean;
			now?: number;
			runRetentionDays?: number;
			artifactRetentionDays?: number;
			artifactKeepNewest?: number;
		}
	): Promise<CleanupResult> {
		const now = options.now ?? Date.now();
		const runBefore = now - (options.runRetentionDays ?? 90) * 86_400_000;
		const artifactBefore = now - (options.artifactRetentionDays ?? 30) * 86_400_000;
		const keep = Math.max(1, options.artifactKeepNewest ?? 3);
		const events = (
			this.db
				.prepare('SELECT COUNT(*) count FROM events WHERE user_id=? AND expires_at<?')
				.get(ownerId, now) as { count: number }
		).count;
		const runs = (
			this.db
				.prepare(
					`SELECT COUNT(*) count FROM runs r WHERE user_id=? AND completed_at<? AND state NOT IN ('queued','running','awaiting-approval') AND NOT EXISTS(SELECT 1 FROM ref_baselines b WHERE b.successful_run_id=r.id) AND NOT EXISTS(SELECT 1 FROM conflicts c WHERE c.run_id=r.id AND c.state='open') AND NOT EXISTS(SELECT 1 FROM backup_artifacts a WHERE a.run_id=r.id)`
				)
				.get(ownerId, runBefore) as { count: number }
		).count;
		const observations = (
			this.db
				.prepare(
					`SELECT COUNT(*) count FROM ref_observations o JOIN runs r ON r.id=o.run_id WHERE r.user_id=? AND r.completed_at<? AND NOT EXISTS(SELECT 1 FROM conflicts c WHERE c.run_id=o.run_id AND c.state='open')`
				)
				.get(ownerId, runBefore) as { count: number }
		).count;
		const notificationDeliveries = (
			this.db
				.prepare(
					`SELECT COUNT(*) count FROM notification_deliveries
				 WHERE user_id=? AND state IN ('delivered','failed') AND updated_at<?`
				)
				.get(ownerId, runBefore) as { count: number }
		).count;
		const artifacts = this.db
			.prepare(
				`SELECT id,relative_path,byte_size FROM (SELECT a.*,ROW_NUMBER() OVER(PARTITION BY route_id ORDER BY created_at DESC) position FROM backup_artifacts a WHERE user_id=? AND verification_status='verified') WHERE position>? AND (created_at<? OR expires_at<?)`
			)
			.all(ownerId, keep, artifactBefore, now) as Array<{
			id: string;
			relative_path: string;
			byte_size: number;
		}>;
		const result: CleanupResult = {
			events,
			runs,
			observations,
			artifacts: artifacts.length,
			artifactBytes: artifacts.reduce((sum, item) => sum + item.byte_size, 0),
			temporaryFiles: 0,
			notificationDeliveries,
			dryRun: options.dryRun
		};
		if (!options.dryRun) {
			transaction(this.db, () => {
				this.db.prepare('DELETE FROM events WHERE user_id=? AND expires_at<?').run(ownerId, now);
				this.db
					.prepare(
						`DELETE FROM notification_deliveries WHERE user_id=?
					 AND state IN ('delivered','failed') AND updated_at<?`
					)
					.run(ownerId, runBefore);
				this.db
					.prepare(
						`DELETE FROM ref_observations WHERE run_id IN (SELECT id FROM runs WHERE user_id=? AND completed_at<?) AND run_id NOT IN (SELECT run_id FROM conflicts WHERE state='open')`
					)
					.run(ownerId, runBefore);
				this.db
					.prepare(
						`DELETE FROM runs WHERE user_id=? AND completed_at<? AND state NOT IN ('queued','running','awaiting-approval') AND NOT EXISTS(SELECT 1 FROM ref_baselines b WHERE b.successful_run_id=runs.id) AND NOT EXISTS(SELECT 1 FROM conflicts c WHERE c.run_id=runs.id AND c.state='open') AND NOT EXISTS(SELECT 1 FROM backup_artifacts a WHERE a.run_id=runs.id)`
					)
					.run(ownerId, runBefore);
				for (const artifact of artifacts)
					this.db
						.prepare('DELETE FROM backup_artifacts WHERE id=? AND user_id=?')
						.run(artifact.id, ownerId);
				this.db
					.prepare(
						'INSERT INTO maintenance_runs(id,user_id,kind,dry_run,result_json,created_at) VALUES(?,?,?,?,?,?)'
					)
					.run(randomUUID(), ownerId, 'retention', 0, JSON.stringify(result), now);
			});
			for (const artifact of artifacts) await this.#deleteArtifact(artifact.relative_path);
		} else
			this.db
				.prepare(
					'INSERT INTO maintenance_runs(id,user_id,kind,dry_run,result_json,created_at) VALUES(?,?,?,?,?,?)'
				)
				.run(randomUUID(), ownerId, 'retention', 1, JSON.stringify(result), now);
		return result;
	}
	async cleanupTemporaryArtifacts(now = Date.now()): Promise<number> {
		const root = path.resolve(config.dataDir, 'backups');
		let entries: string[];
		try {
			entries = (await readdir(root, { recursive: true, encoding: 'utf8' })).map(String);
		} catch {
			return 0;
		}
		let removed = 0;
		for (const entry of entries) {
			if (!entry.endsWith('.tmp')) continue;
			const candidate = path.resolve(root, entry);
			if (!candidate.startsWith(`${root}${path.sep}`)) continue;
			try {
				if ((await stat(candidate)).mtimeMs < now - 3_600_000) {
					await unlink(candidate);
					removed += 1;
				}
			} catch {
				/* raced cleanup */
			}
		}
		return removed;
	}
	async #deleteArtifact(relative: string): Promise<void> {
		const dataRoot = path.resolve(config.dataDir);
		const candidate = path.resolve(dataRoot, relative);
		const backupRoot = path.resolve(dataRoot, 'backups');
		if (!candidate.startsWith(`${backupRoot}${path.sep}`)) return;
		try {
			await unlink(candidate);
		} catch {
			/* missing files are already clean */
		}
	}
}
let instance: MaintenanceService | undefined;
export function maintenanceService() {
	instance ??= new MaintenanceService(database());
	return instance;
}
