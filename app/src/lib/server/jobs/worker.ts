import { JobQueue } from './queue';
import type { StepHandlerRegistry } from './handlers';
import { createLogger } from '$lib/server/logging';

const LEASE_MS = 30_000;
const IDLE_MS = 1_000;
const logger = createLogger('gittransit-worker');

const delay = (milliseconds: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, milliseconds);
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true }
		);
	});

export async function runWorker(
	queue: JobQueue,
	handlers: StepHandlerRegistry,
	workerId: string,
	signal: AbortSignal
): Promise<void> {
	queue.heartbeatWorker(workerId);
	const workerHeartbeat = setInterval(() => queue.heartbeatWorker(workerId), 10_000);
	logger.info({ workerId }, 'worker started');
	while (!signal.aborted) {
		const claim = queue.claimNext(workerId, LEASE_MS);
		if (!claim) {
			await delay(IDLE_MS, signal);
			continue;
		}
		const heartbeat = setInterval(() => {
			if (!queue.heartbeat(claim, LEASE_MS)) clearInterval(heartbeat);
		}, LEASE_MS / 3);
		try {
			const checkpoint = await handlers.get(claim.name)(claim, signal);
			const durableCheckpoint = { ...claim.checkpoint, ...checkpoint };
			if (!queue.checkpoint(claim, durableCheckpoint)) {
				logger.warn({ workerId, stepId: claim.stepId }, 'step lease became stale');
			} else if (
				checkpoint.outcome === 'awaiting-approval' &&
				typeof checkpoint.approvalId === 'string'
			) {
				if (!queue.awaitApproval(claim, checkpoint.approvalId))
					logger.warn({ workerId, stepId: claim.stepId }, 'approval checkpoint lease became stale');
			} else if (checkpoint.outcome === 'conflicted' || checkpoint.outcome === 'partial') {
				const resourceIds = Array.isArray(checkpoint.resourceIds)
					? checkpoint.resourceIds.filter((value): value is string => typeof value === 'string')
					: [];
				if (!queue.terminalOutcome(claim, checkpoint.outcome, resourceIds))
					logger.warn({ workerId, stepId: claim.stepId }, 'terminal outcome lease became stale');
			} else if (checkpoint.outcome === 'two-way-verified') {
				if (!queue.completeTwoWay(claim, durableCheckpoint))
					logger.warn(
						{ workerId, stepId: claim.stepId },
						'two-way baseline finalization lease became stale'
					);
			} else if (!queue.complete(claim))
				logger.warn({ workerId, stepId: claim.stepId }, 'step lease became stale');
		} catch (error) {
			logger.error({ workerId, stepId: claim.stepId, error }, 'step failed');
			queue.failOrRetry(claim, 'STEP_FAILED', Math.min(60_000, 1_000 * 2 ** claim.attempt));
		} finally {
			clearInterval(heartbeat);
		}
	}
	clearInterval(workerHeartbeat);
	queue.heartbeatWorker(workerId, true);
	logger.info({ workerId }, 'worker stopped');
}
