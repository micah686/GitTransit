import type { RefAction, SafetyPolicy } from './types';

export interface SafetyDecision {
	readonly disposition: 'apply' | 'block' | 'await-approval' | 'conflict';
	readonly requiresBackup: boolean;
	readonly destructive: boolean;
}

export function assessAction(action: RefAction, policy: SafetyPolicy): SafetyDecision {
	if (action.kind === 'conflict') {
		return { disposition: 'conflict', requiresBackup: false, destructive: false };
	}
	const destructive = action.kind === 'force-update' || action.kind === 'delete';
	if (!destructive) return { disposition: 'apply', requiresBackup: false, destructive: false };
	if (policy.strategy === 'fast-forward-only' || policy.strategy === 'never-delete') {
		return { disposition: 'block', requiresBackup: false, destructive: true };
	}
	if (policy.strategy === 'approve-destructive') {
		return { disposition: 'await-approval', requiresBackup: true, destructive: true };
	}
	return { disposition: 'apply', requiresBackup: policy.requireBackup, destructive: true };
}

export const isDestructive = (action: RefAction): boolean =>
	action.kind === 'force-update' || action.kind === 'delete';
