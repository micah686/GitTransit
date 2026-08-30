import { randomUUID } from 'node:crypto';
import { database, closeDatabase } from '$lib/server/persistence/database';
import { JobQueue } from '$lib/server/jobs/queue';
import { phaseThreeHandlers } from '$lib/server/jobs/handlers';
import { runWorker } from '$lib/server/jobs/worker';
import { PairRunService } from '$lib/server/application/pair-run-service';

const shutdown = new AbortController();
process.once('SIGINT', () => shutdown.abort());
process.once('SIGTERM', () => shutdown.abort());

const scheduler = new PairRunService(database());
const schedulerTimer = setInterval(() => scheduler.enqueueDue(), 30_000);
scheduler.enqueueDue();

await runWorker(
	new JobQueue(database()),
	phaseThreeHandlers(database()),
	`worker-${randomUUID()}`,
	shutdown.signal
);
clearInterval(schedulerTimer);
closeDatabase();
