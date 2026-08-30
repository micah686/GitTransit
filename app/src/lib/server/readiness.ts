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
	} catch {
		checks.dataDirectories = 'failed';
	}
	try {
		await execFileAsync(process.env.GITTRANSIT_GIT_PATH ?? 'git', ['--version'], {
			timeout: 3_000
		});
		checks.git = 'ok';
	} catch {
		checks.git = 'failed';
	}
	return { ready: Object.values(checks).every((value) => value === 'ok'), checks };
}
