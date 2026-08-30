import { describe, expect, it } from 'vitest';
import { entityId, oid, refName, type Side } from '../domain/types';
import type { GitTransport } from './types';
import { executeTwoWay, PartialTwoWayError } from './two-way';
const x = refName('refs/heads/x'),
	y = refName('refs/heads/y'),
	x0 = oid('0'.repeat(40)),
	x1 = oid('1'.repeat(40)),
	y0 = oid('2'.repeat(40)),
	y1 = oid('3'.repeat(40));
function transportFixture() {
	const refs: Record<Side, Map<typeof x, typeof x0>> = {
		A: new Map([
			[x, x1],
			[y, y0]
		]),
		B: new Map([
			[x, x0],
			[y, y1]
		])
	};
	let failB = true;
	const transfers: Array<{ from: Side; to: Side; refs: readonly string[] }> = [];
	const transport: GitTransport = {
		lsRemote: async (endpoint) => new Map(refs[endpoint.stableIdentity as Side]),
		prepareWorkspace: async (routeId, runId, endpoints) => ({
			routeId,
			runId,
			endpoints,
			repositoryPath: 'memory',
			controlPath: 'memory',
			transient: false
		}),
		fetch: async (_workspace, side) => new Map(refs[side]),
		isAncestor: async (_workspace, oldValue, newValue) =>
			(oldValue === x0 && newValue === x1) || (oldValue === y0 && newValue === y1),
		push: async (_workspace, side, plan) => {
			if (side === 'B' && failB) throw new Error('simulated second host failure');
			for (const action of plan.actions) {
				if (action.kind === 'delete') refs[side].delete(action.ref as typeof x);
				else if (action.kind !== 'noop' && action.kind !== 'conflict')
					refs[side].set(action.ref as typeof x, action.newOid as typeof x0);
			}
			return new Map(refs[side]);
		},
		createBundle: async () => ({ path: 'bundle', digest: 'd'.repeat(64), byteSize: 1 }),
		transferLfs: async (_workspace, from, to, refsToMove) => {
			transfers.push({ from, to, refs: refsToMove });
		},
		isLfsAvailable: async () => false,
		disposeWorkspace: async () => {}
	};
	return {
		transport,
		refs,
		transfers,
		allowB: () => {
			failB = false;
		}
	};
}
describe('partial two-host recovery', () => {
	it('records the applied side and converges from observed reality on retry', async () => {
		const fixture = transportFixture();
		const baseline = new Map([
			[x, { a: x0, b: x0 }],
			[y, { a: y0, b: y0 }]
		]);
		const request = {
			routeId: entityId('route'),
			runId: 'partial',
			endpointA: { url: new URL('https://a.test/r'), credentialId: null, stableIdentity: 'A' },
			endpointB: { url: new URL('https://b.test/r'), credentialId: null, stableIdentity: 'B' },
			refs: { includes: [], excludes: [], targetOnly: 'delete-with-approval' as const },
			safety: { strategy: 'backup-and-apply' as const, requireBackup: true },
			lfs: 'on' as const,
			baselines: baseline,
			initialized: true,
			initialMode: 'require-equality' as const,
			capabilityGeneration: 1,
			policyGeneration: 1,
			assertLeaseCurrent: () => true
		};
		try {
			await executeTwoWay(fixture.transport, request);
			throw new Error('expected partial');
		} catch (error) {
			expect(error).toBeInstanceOf(PartialTwoWayError);
			expect((error as PartialTwoWayError).appliedSides).toEqual(['A']);
		}
		expect(fixture.refs.A.get(y)).toBe(y1);
		expect(fixture.refs.B.get(x)).toBe(x0);
		fixture.allowB();
		const recovered = await executeTwoWay(fixture.transport, { ...request, runId: 'recovery' });
		expect(recovered.state).toBe('succeeded');
		expect(fixture.refs.A).toEqual(fixture.refs.B);
		expect(fixture.transfers).toContainEqual({ from: 'A', to: 'B', refs: [x] });
	});
});
