import type { RunState } from './types';

const runTransitions: Readonly<Record<RunState, ReadonlySet<RunState>>> = {
	queued: new Set(['running', 'cancelled']),
	running: new Set([
		'awaiting-approval',
		'conflicted',
		'succeeded',
		'partial',
		'failed',
		'cancelled',
		'interrupted'
	]),
	'awaiting-approval': new Set(['queued', 'cancelled']),
	conflicted: new Set(['cancelled']),
	succeeded: new Set(),
	partial: new Set(['queued']),
	failed: new Set(['queued']),
	cancelled: new Set(),
	interrupted: new Set(['queued', 'failed'])
};

export function canTransitionRun(from: RunState, to: RunState): boolean {
	return runTransitions[from].has(to);
}

export function assertRunTransition(from: RunState, to: RunState): void {
	if (!canTransitionRun(from, to)) throw new Error(`Invalid run transition: ${from} -> ${to}`);
}
