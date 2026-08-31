import { randomUUID } from 'node:crypto';
import { database, closeDatabase } from '$lib/server/persistence/database';
import { JobQueue } from '$lib/server/jobs/queue';
import { phaseThreeHandlers } from '$lib/server/jobs/handlers';
import { runWorker } from '$lib/server/jobs/worker';
import { PairRunService } from '$lib/server/application/pair-run-service';
import { RecoveryService } from '$lib/server/operations/recovery';
import { NotificationService, runNotificationDispatcher } from '$lib/server/notifications/service';

const shutdown = new AbortController();
const scheduler = new PairRunService(database());
await new RecoveryService(database()).run();
const schedulerId = `scheduler-${randomUUID()}`;
const schedulerTimer = setInterval(() => scheduler.enqueueDue(Date.now(), schedulerId), 30_000);
const stop = () => {
	clearInterval(schedulerTimer);
	shutdown.abort();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
scheduler.enqueueDue(Date.now(), schedulerId);

await Promise.all([
	runWorker(
		new JobQueue(database()),
		phaseThreeHandlers(database()),
		`worker-${randomUUID()}`,
		shutdown.signal
	),
	runNotificationDispatcher(
		new NotificationService(database()),
		`notification-${randomUUID()}`,
		shutdown.signal
	)
]);
clearInterval(schedulerTimer);
closeDatabase();
