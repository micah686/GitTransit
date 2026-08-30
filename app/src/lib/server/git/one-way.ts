import type {
	EntityId,
	ImmutableRefPlan,
	LfsPolicy,
	ManagedRefPolicy,
	RefAction,
	SafetyPolicy
} from '../domain/types';
import { assessAction } from '../domain/safety-policy';
import { planOneWayRefs } from '../domain/ref-plan';
import type { AuthenticatedEndpoint, GitTransport, VerifiedArtifact } from './types';

export interface OneWayRequest {
	readonly routeId: EntityId;
	readonly runId: string;
	readonly endpointA: AuthenticatedEndpoint;
	readonly endpointB: AuthenticatedEndpoint;
	readonly refs: ManagedRefPolicy;
	readonly safety: SafetyPolicy;
	readonly lfs: LfsPolicy;
	readonly capabilityGeneration: number;
	readonly policyGeneration: number;
	/** Called immediately before every remote mutation to enforce the durable fencing token. */
	readonly assertLeaseCurrent: () => Promise<boolean> | boolean;
}

export type OneWayResult =
	| {
			readonly state: 'blocked' | 'awaiting-approval' | 'conflicted';
			readonly plan: ImmutableRefPlan;
	  }
	| {
			readonly state: 'succeeded';
			readonly plan: ImmutableRefPlan;
			readonly artifact: VerifiedArtifact | null;
	  };

function relevantPatterns(policy: ManagedRefPolicy): readonly string[] {
	return policy.includes.length ? policy.includes : ['refs/heads/*', 'refs/tags/*'];
}

function excluded(action: RefAction, excludes: readonly string[]): boolean {
	return excludes.some((pattern) =>
		pattern.endsWith('*') ? action.ref.startsWith(pattern.slice(0, -1)) : action.ref === pattern
	);
}

export async function executeOneWay(
	transport: GitTransport,
	request: OneWayRequest
): Promise<OneWayResult> {
	const endpoints = { A: request.endpointA, B: request.endpointB } as const;
	const workspace = await transport.prepareWorkspace(request.routeId, request.runId, endpoints);
	try {
		const patterns = relevantPatterns(request.refs);
		const a = await transport.fetch(workspace, 'A', patterns);
		const b = await transport.fetch(workspace, 'B', patterns);
		const actions = (
			await planOneWayRefs(a, b, request.refs.targetOnly, (older, newer) =>
				transport.isAncestor(workspace, older, newer)
			)
		).filter((action) => !excluded(action, request.refs.excludes));
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
		const decisions = actions.map((action) => assessAction(action, request.safety));
		if (decisions.some((decision) => decision.disposition === 'conflict'))
			return { state: 'conflicted', plan };
		if (decisions.some((decision) => decision.disposition === 'block'))
			return { state: 'blocked', plan };
		if (decisions.some((decision) => decision.disposition === 'await-approval'))
			return { state: 'awaiting-approval', plan };

		const mutating = actions.filter(
			(action) => action.kind !== 'noop' && action.kind !== 'conflict'
		);
		if (!mutating.length) return { state: 'succeeded', plan, artifact: null };
		const requiresBackup = decisions.some((decision) => decision.requiresBackup);
		const artifact = requiresBackup ? await transport.createBundle(workspace, 'B') : null;
		if (!(await request.assertLeaseCurrent()))
			throw new Error('Route lease became stale before push.');
		await transport.push(
			workspace,
			'B',
			plan,
			mutating.map((action) => ({
				ref: action.ref,
				expectedOid: b.get(action.ref) ?? null
			}))
		);
		if (request.lfs === 'on' || (request.lfs === 'auto' && (await transport.isLfsAvailable()))) {
			if (!(await request.assertLeaseCurrent()))
				throw new Error('Route lease became stale before LFS transfer.');
			await transport.transferLfs(workspace, 'A', 'B', [...a.keys()]);
		}
		return { state: 'succeeded', plan, artifact };
	} finally {
		await transport.disposeWorkspace(workspace);
	}
}

export interface LinkedWikiRoute {
	readonly parentRouteId: EntityId;
	readonly routeId: EntityId;
	readonly endpointA: AuthenticatedEndpoint;
	readonly endpointB: AuthenticatedEndpoint;
}

export function linkedWikiRoute(
	parentRouteId: EntityId,
	routeId: EntityId,
	endpointA: AuthenticatedEndpoint,
	endpointB: AuthenticatedEndpoint
): LinkedWikiRoute {
	return { parentRouteId, routeId, endpointA, endpointB };
}
