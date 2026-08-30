import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '$lib/server/config';
import { database } from '$lib/server/persistence/database';
import { loadEncryptionKey } from '$lib/server/crypto/credentials';

const execFileAsync = promisify(execFile);

export interface ReadinessResult {
	ready: boolean;
	checks: Record<string, 'ok' | 'failed'>;
}

export async function checkReadiness(): Promise<ReadinessResult> {
	const checks: Record<string, 'ok' | 'failed'> = {};
	try {
		database().prepare('SELECT 1').get();
		checks.database = 'ok';
	} catch {
		checks.database = 'failed';
	}
	try {
		loadEncryptionKey(config.encryptionKeyFile);
		checks.encryptionKey = 'ok';
	} catch {
		checks.encryptionKey = 'failed';
	}
	try {
		for (const directory of [
			path.dirname(config.databasePath),
			path.join(config.dataDir, 'work'),
			path.join(config.dataDir, 'backups')
		]) {
			fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
			fs.accessSync(directory, fs.constants.R_OK | fs.constants.W_OK);
		}
		checks.dataDirectories = 'ok';
		const capacity = fs.statfsSync(config.dataDir);
		const freeBytes = capacity.bavail * capacity.bsize;
		const minimum = Number(process.env.GITTRANSIT_MIN_FREE_BYTES ?? 536_870_912);
		checks.diskPressure = freeBytes >= minimum ? 'ok' : 'failed';
	} catch {
		checks.dataDirectories = 'failed';
		checks.diskPressure = 'failed';
	}
	try {
		await execFileAsync(process.env.GITTRANSIT_GIT_PATH ?? 'git', ['--version'], {
			timeout: 3_000
		});
		checks.git = 'ok';
	} catch {
		checks.git = 'failed';
	}
	try {
		const db = database();
		const activeWork = (
			db
				.prepare("SELECT COUNT(*) AS count FROM runs WHERE state IN ('queued','running')")
				.get() as {
				count: number;
			}
		).count;
		const recentWorker = (
			db
				.prepare(
					'SELECT COUNT(*) AS count FROM worker_heartbeats WHERE stopped_at IS NULL AND heartbeat_at>?'
				)
				.get(Date.now() - 60_000) as { count: number }
		).count;
		checks.worker = activeWork === 0 || recentWorker > 0 ? 'ok' : 'failed';
	} catch {
		checks.worker = 'failed';
	}
	return { ready: Object.values(checks).every((value) => value === 'ok'), checks };
}
