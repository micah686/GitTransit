import { randomUUID } from 'node:crypto';
import { database, closeDatabase } from '$lib/server/persistence/database';
import { JobQueue } from '$lib/server/jobs/queue';
import { phaseThreeHandlers } from '$lib/server/jobs/handlers';
import { runWorker } from '$lib/server/jobs/worker';

const shutdown = new AbortController();
process.once('SIGINT', () => shutdown.abort());
process.once('SIGTERM', () => shutdown.abort());

await runWorker(
	new JobQueue(database()),
	phaseThreeHandlers(database()),
	`worker-${randomUUID()}`,
	shutdown.signal
);
closeDatabase();
