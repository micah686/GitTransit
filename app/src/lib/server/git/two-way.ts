import type {
	EntityId,
	ImmutableRefPlan,
	InitialBaselineMode,
	LfsPolicy,
	ManagedRefPolicy,
	RefAction,
	RefBaseline,
	RefMap,
	RefName,
	SafetyPolicy,
	Side,
	Oid
} from '../domain/types';
import { assessAction } from '../domain/safety-policy';
import { planOneWayRef, planOneWayRefs, planTwoWayRefs } from '../domain/ref-plan';
import { planDigest } from '../safety/approvals';
import type { AuthenticatedEndpoint, GitTransport, VerifiedArtifact, Workspace } from './types';

export type TwoWayResolution =
	| 'A'
	| 'B'
	| 'external'
	| { readonly kind: 'commit'; readonly oid: Oid }
	| { readonly kind: 'keep-both'; readonly winner: 'A' | 'B'; readonly newRef: RefName };
export interface TwoWayRequest {
	routeId: EntityId;
	runId: string;
	endpointA: AuthenticatedEndpoint;
	endpointB: AuthenticatedEndpoint;
	refs: ManagedRefPolicy;
	safety: SafetyPolicy;
	lfs: LfsPolicy;
	baselines: ReadonlyMap<RefName, RefBaseline>;
	initialized: boolean;
	initialMode: InitialBaselineMode;
	capabilityGeneration: number;
	policyGeneration: number;
	approvedPlan?: ImmutableRefPlan;
	resolutions?: ReadonlyMap<RefName, TwoWayResolution>;
	onPlan?: (plan: ImmutableRefPlan, observedA: RefMap, observedB: RefMap) => Promise<void> | void;
	assertLeaseCurrent: () => Promise<boolean> | boolean;
}
export type TwoWayResult =
	| {
			state: 'conflicted' | 'blocked' | 'awaiting-approval';
			plan: ImmutableRefPlan;
			observedA: RefMap;
			observedB: RefMap;
	  }
	| {
			state: 'succeeded';
			plan: ImmutableRefPlan;
			observedA: RefMap;
			observedB: RefMap;
			finalA: RefMap;
			finalB: RefMap;
			artifacts: readonly { side: Side; artifact: VerifiedArtifact }[];
	  };
export class PartialTwoWayError extends Error {
	constructor(
		readonly plan: ImmutableRefPlan,
		readonly appliedSides: readonly Side[],
		readonly artifacts: readonly { side: Side; artifact: VerifiedArtifact }[]
	) {
		super('TWO_WAY_PARTIAL_WRITE');
		this.name = 'PartialTwoWayError';
	}
}
const patterns = (policy: ManagedRefPolicy) =>
	policy.includes.length ? policy.includes : ['refs/heads/*', 'refs/tags/*'];
const excluded = (action: RefAction, values: readonly string[]) =>
	values.some((pattern) =>
		pattern.endsWith('*') ? action.ref.startsWith(pattern.slice(0, -1)) : action.ref === pattern
	);
const mutationSide = (action: RefAction): Side | null =>
	action.kind === 'delete'
		? action.from
		: action.kind === 'create' || action.kind === 'fast-forward' || action.kind === 'force-update'
			? action.to
			: null;
function swap(action: RefAction): RefAction {
	if (action.kind === 'create') return { ...action, to: 'A' };
	if (action.kind === 'fast-forward' || action.kind === 'force-update')
		return { ...action, to: 'A' };
	if (action.kind === 'delete') return { ...action, from: 'A' };
	return action;
}
async function initialActions(
	transport: GitTransport,
	request: TwoWayRequest,
	workspace: Workspace,
	a: RefMap,
	b: RefMap
): Promise<readonly RefAction[]> {
	if (request.initialMode === 'seed-a-to-b')
		return planOneWayRefs(a, b, request.refs.targetOnly, (oldOid, newOid) =>
			transport.isAncestor(workspace, oldOid, newOid)
		);
	if (request.initialMode === 'seed-b-to-a')
		return (
			await planOneWayRefs(b, a, request.refs.targetOnly, (oldOid, newOid) =>
				transport.isAncestor(workspace, oldOid, newOid)
			)
		).map(swap);
	const refs = new Set<RefName>([...a.keys(), ...b.keys()]);
	return [...refs].sort().map((ref) => {
		const av = a.get(ref) ?? null,
			bv = b.get(ref) ?? null;
		return av === bv
			? { kind: 'noop', ref, ...(av ? { oid: av } : {}) }
			: ({ kind: 'conflict', ref, reason: 'destination-mismatch' } as RefAction);
	});
}
function subset(plan: ImmutableRefPlan, actions: readonly RefAction[]): ImmutableRefPlan {
	return { ...plan, actions };
}
async function resolvedActions(
	request: TwoWayRequest,
	workspace: Workspace,
	a: RefMap,
	b: RefMap,
	actions: readonly RefAction[],
	transport: GitTransport
): Promise<readonly RefAction[]> {
	if (!request.resolutions?.size) return actions;
	const result: RefAction[] = [];
	for (const action of actions) {
		const resolution = request.resolutions.get(action.ref);
		if (!resolution || resolution === 'external' || action.kind !== 'conflict') {
			result.push(action);
			continue;
		}
		const ancestry = (
			oldOid: import('../domain/types').Oid,
			newOid: import('../domain/types').Oid
		) => transport.isAncestor(workspace, oldOid, newOid);
		if (resolution === 'A' || resolution === 'B') {
			result.push(
				resolution === 'A'
					? await planOneWayRef(
							action.ref,
							a.get(action.ref) ?? null,
							b.get(action.ref) ?? null,
							'delete-with-approval',
							ancestry
						)
					: swap(
							await planOneWayRef(
								action.ref,
								b.get(action.ref) ?? null,
								a.get(action.ref) ?? null,
								'delete-with-approval',
								ancestry
							)
						)
			);
			continue;
		}
		if (resolution.kind === 'commit') {
			const currentA = a.get(action.ref) ?? null;
			const currentB = b.get(action.ref) ?? null;
			const reachable = await Promise.all(
				[currentA, currentB]
					.filter((value): value is Oid => value !== null)
					.map(async (value) =>
						value === resolution.oid
							? true
							: transport.isAncestor(workspace, resolution.oid, value).catch(() => false)
					)
			);
			if (!reachable.some(Boolean)) throw new Error('RESOLUTION_COMMIT_NOT_REACHABLE');
			result.push(
				swap(
					await planOneWayRef(
						action.ref,
						resolution.oid,
						currentA,
						'delete-with-approval',
						ancestry
					)
				),
				await planOneWayRef(action.ref, resolution.oid, currentB, 'delete-with-approval', ancestry)
			);
			continue;
		}
		const winnerOid = (resolution.winner === 'A' ? a : b).get(action.ref) ?? null;
		const losingOid = (resolution.winner === 'A' ? b : a).get(action.ref) ?? null;
		if (!winnerOid || !losingOid) throw new Error('KEEP_BOTH_REQUIRES_TWO_BRANCH_TIPS');
		const preservedA = a.get(resolution.newRef) ?? null;
		const preservedB = b.get(resolution.newRef) ?? null;
		if (
			(preservedA !== null && preservedA !== losingOid) ||
			(preservedB !== null && preservedB !== losingOid)
		)
			throw new Error('KEEP_BOTH_REF_OCCUPIED');
		result.push(
			swap(
				await planOneWayRef(
					resolution.newRef,
					losingOid,
					preservedA,
					'delete-with-approval',
					ancestry
				)
			),
			await planOneWayRef(
				resolution.newRef,
				losingOid,
				preservedB,
				'delete-with-approval',
				ancestry
			),
			resolution.winner === 'A'
				? await planOneWayRef(
						action.ref,
						winnerOid,
						b.get(action.ref) ?? null,
						'delete-with-approval',
						ancestry
					)
				: swap(
						await planOneWayRef(
							action.ref,
							winnerOid,
							a.get(action.ref) ?? null,
							'delete-with-approval',
							ancestry
						)
					)
		);
	}
	return result;
}

export async function executeTwoWay(
	transport: GitTransport,
	request: TwoWayRequest
): Promise<TwoWayResult> {
	const endpoints = { A: request.endpointA, B: request.endpointB } as const;
	const workspace = await transport.prepareWorkspace(request.routeId, request.runId, endpoints);
	try {
		const a = await transport.fetch(workspace, 'A', patterns(request.refs));
		const b = await transport.fetch(workspace, 'B', patterns(request.refs));
		let actions = request.initialized
			? await planTwoWayRefs(request.baselines, a, b, (oldOid, newOid) =>
					transport.isAncestor(workspace, oldOid, newOid)
				)
			: await initialActions(transport, request, workspace, a, b);
		actions = await resolvedActions(request, workspace, a, b, actions, transport);
		actions = actions.filter((action) => !excluded(action, request.refs.excludes));
		const plan: ImmutableRefPlan = {
			routeId: request.routeId,
			observedEndpointA: request.endpointA.stableIdentity,
			observedEndpointB: request.endpointB.stableIdentity,
			capabilityGeneration: request.capabilityGeneration,
			policyGeneration: request.policyGeneration,
			expectedA: a,
			expectedB: b,
			actions
		};
		await request.onPlan?.(plan, a, b);
		if (actions.some((action) => action.kind === 'conflict'))
			return { state: 'conflicted', plan, observedA: a, observedB: b };
		const decisions = actions.map((action) => assessAction(action, request.safety));
		if (decisions.some((decision) => decision.disposition === 'block'))
			return { state: 'blocked', plan, observedA: a, observedB: b };
		if (decisions.some((decision) => decision.disposition === 'await-approval')) {
			if (!request.approvedPlan)
				return { state: 'awaiting-approval', plan, observedA: a, observedB: b };
			if (planDigest(plan) !== planDigest(request.approvedPlan))
				throw new Error('APPROVED_PLAN_STALE');
		}
		const mutating = actions.filter((action) => mutationSide(action) !== null);
		if (!mutating.length)
			return {
				state: 'succeeded',
				plan,
				observedA: a,
				observedB: b,
				finalA: a,
				finalB: b,
				artifacts: []
			};
		const artifacts: { side: Side; artifact: VerifiedArtifact }[] = [];
		for (const side of ['A', 'B'] as const) {
			if (
				mutating.some(
					(action) =>
						mutationSide(action) === side && assessAction(action, request.safety).requiresBackup
				)
			)
				artifacts.push({ side, artifact: await transport.createBundle(workspace, side) });
		}
		const applied: Side[] = [];
		try {
			for (const destructive of [false, true])
				for (const side of ['A', 'B'] as const) {
					const selected = mutating.filter(
						(action) =>
							mutationSide(action) === side &&
							['force-update', 'delete'].includes(action.kind) === destructive
					);
					if (!selected.length) continue;
					if (!(await request.assertLeaseCurrent()))
						throw new Error('Route lease became stale before two-way push.');
					const expected = side === 'A' ? a : b;
					await transport.push(
						workspace,
						side,
						subset(plan, selected),
						selected.map((action) => ({
							ref: action.ref,
							expectedOid: expected.get(action.ref) ?? null
						}))
					);
					if (!applied.includes(side)) applied.push(side);
				}
		} catch (error) {
			if (applied.length) throw new PartialTwoWayError(plan, applied, artifacts);
			throw error;
		}
		try {
			if (request.lfs === 'on' || (request.lfs === 'auto' && (await transport.isLfsAvailable()))) {
				const toA = mutating
					.filter((action) => mutationSide(action) === 'A')
					.map((action) => action.ref);
				const toB = mutating
					.filter((action) => mutationSide(action) === 'B')
					.map((action) => action.ref);
				if (toA.length) await transport.transferLfs(workspace, 'B', 'A', toA);
				if (toB.length) await transport.transferLfs(workspace, 'A', 'B', toB);
			}
		} catch (error) {
			if (applied.length) throw new PartialTwoWayError(plan, applied, artifacts);
			throw error;
		}
		const finalA = await transport.lsRemote(request.endpointA),
			finalB = await transport.lsRemote(request.endpointB);
		const managed = new Set([...a.keys(), ...b.keys(), ...actions.map((action) => action.ref)]);
		for (const ref of managed)
			if ((finalA.get(ref) ?? null) !== (finalB.get(ref) ?? null))
				throw new PartialTwoWayError(plan, applied, artifacts);
		return { state: 'succeeded', plan, observedA: a, observedB: b, finalA, finalB, artifacts };
	} finally {
		await transport.disposeWorkspace(workspace);
	}
}
