import Database from 'better-sqlite3';
import { writeSync } from 'node:fs';

const emit = (event) => writeSync(1, `${JSON.stringify(event)}\n`);

const [databasePath, jobId, workerId, leaseText, holdText] = process.argv.slice(2);
if (!databasePath || !jobId || !workerId || !leaseText || !holdText) {
	throw new Error('usage: sqlite-worker.mjs DATABASE JOB WORKER LEASE_MS HOLD_MS');
}

const database = new Database(databasePath);
database.pragma('journal_mode = WAL');
database.pragma('busy_timeout = 5000');
const now = Date.now();
const expiresAt = now + Number(leaseText);
const row = database
	.prepare(
		`UPDATE jobs
		 SET state = 'running', lease_owner = ?, lease_expires_at = ?, fencing_token = fencing_token + 1
		 WHERE id = ? AND state != 'succeeded'
		   AND (lease_owner IS NULL OR lease_expires_at <= ? OR lease_owner = ?)
		 RETURNING fencing_token`
	)
	.get(workerId, expiresAt, jobId, now, workerId);

if (!row) {
	emit({ workerId, claimed: false });
	database.close();
} else {
	emit({ workerId, claimed: true, token: row.fencing_token });
	setTimeout(() => {
		const result = database
			.prepare(
				`UPDATE jobs SET state = 'succeeded', result = ?, lease_owner = NULL, lease_expires_at = NULL
				 WHERE id = ? AND state = 'running' AND lease_owner = ?
				   AND fencing_token = ? AND lease_expires_at > ?`
			)
			.run(workerId, jobId, workerId, row.fencing_token, Date.now());
		emit({ workerId, finalized: result.changes === 1 });
		database.close();
	}, Number(holdText));
}
