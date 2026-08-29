import Database from 'better-sqlite3';

export interface JobClaim {
	readonly jobId: string;
	readonly workerId: string;
	readonly fencingToken: number;
	readonly expiresAt: number;
}

export class FencedJobStore {
	readonly #database: Database.Database;

	constructor(path: string) {
		this.#database = new Database(path);
		this.#database.pragma('journal_mode = WAL');
		this.#database.pragma('busy_timeout = 5000');
		this.#database.pragma('foreign_keys = ON');
	}

	initialize(): void {
		this.#database.exec(`
			CREATE TABLE IF NOT EXISTS jobs (
				id TEXT PRIMARY KEY,
				state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'succeeded')),
				lease_owner TEXT,
				lease_expires_at INTEGER,
				fencing_token INTEGER NOT NULL DEFAULT 0,
				result TEXT
			) STRICT;
		`);
	}

	enqueue(jobId: string): void {
		this.#database
			.prepare("INSERT INTO jobs (id, state) VALUES (?, 'queued') ON CONFLICT(id) DO NOTHING")
			.run(jobId);
	}

	claim(jobId: string, workerId: string, now: number, leaseMs: number): JobClaim | null {
		const expiresAt = now + leaseMs;
		const result = this.#database
			.prepare(
				`UPDATE jobs
				 SET state = 'running', lease_owner = ?, lease_expires_at = ?, fencing_token = fencing_token + 1
				 WHERE id = ?
				   AND state != 'succeeded'
				   AND (lease_owner IS NULL OR lease_expires_at <= ? OR lease_owner = ?)
				 RETURNING fencing_token`
			)
			.get(workerId, expiresAt, jobId, now, workerId) as { fencing_token: number } | undefined;
		return result ? { jobId, workerId, fencingToken: result.fencing_token, expiresAt } : null;
	}

	finalize(claim: JobClaim, result: string, now: number): boolean {
		const update = this.#database
			.prepare(
				`UPDATE jobs
				 SET state = 'succeeded', result = ?, lease_owner = NULL, lease_expires_at = NULL
				 WHERE id = ? AND state = 'running' AND lease_owner = ?
				   AND fencing_token = ? AND lease_expires_at > ?`
			)
			.run(result, claim.jobId, claim.workerId, claim.fencingToken, now);
		return update.changes === 1;
	}

	read(jobId: string): Readonly<Record<string, unknown>> | undefined {
		return this.#database.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as
			Readonly<Record<string, unknown>> | undefined;
	}

	close(): void {
		this.#database.close();
	}
}
