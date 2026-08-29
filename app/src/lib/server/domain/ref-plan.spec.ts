import { describe, expect, it } from 'vitest';
import { planOneWayRef, planTwoWayRef, type AncestryCheck } from './ref-plan';
import { assessAction, isDestructive } from './safety-policy';
import { oid, refName, type MaybeOid, type Oid, type RefBaseline } from './types';

const base = oid('1111111111111111111111111111111111111111');
const aTip = oid('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
const bTip = oid('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
const shared = oid('cccccccccccccccccccccccccccccccccccccccc');
const branch = refName('refs/heads/main');
const tag = refName('refs/tags/v1');

const ancestry =
	(...pairs: readonly (readonly [Oid, Oid])[]): AncestryCheck =>
	async (older, newer) =>
		pairs.some(
			([candidateOlder, candidateNewer]) => candidateOlder === older && candidateNewer === newer
		);

interface TwoWayCase {
	readonly name: string;
	readonly baseline: RefBaseline;
	readonly a: MaybeOid;
	readonly b: MaybeOid;
	readonly ancestors?: readonly (readonly [Oid, Oid])[];
	readonly expected: Readonly<Record<string, unknown>>;
}

describe('two-way decision table', () => {
	const cases: readonly TwoWayCase[] = [
		{
			name: 'neither side changed',
			baseline: { a: base, b: base },
			a: base,
			b: base,
			expected: { kind: 'noop', oid: base }
		},
		{
			name: 'only A changed',
			baseline: { a: base, b: base },
			a: aTip,
			b: base,
			ancestors: [[base, aTip]],
			expected: { kind: 'fast-forward', oldOid: base, newOid: aTip, to: 'B' }
		},
		{
			name: 'only B changed',
			baseline: { a: base, b: base },
			a: base,
			b: bTip,
			ancestors: [[base, bTip]],
			expected: { kind: 'fast-forward', oldOid: base, newOid: bTip, to: 'A' }
		},
		{
			name: 'both now have the same OID',
			baseline: { a: base, b: base },
			a: shared,
			b: shared,
			expected: { kind: 'noop', oid: shared }
		},
		{
			name: 'A is ancestor of B',
			baseline: { a: base, b: base },
			a: aTip,
			b: bTip,
			ancestors: [[aTip, bTip]],
			expected: { kind: 'fast-forward', oldOid: aTip, newOid: bTip, to: 'A' }
		},
		{
			name: 'B is ancestor of A',
			baseline: { a: base, b: base },
			a: aTip,
			b: bTip,
			ancestors: [[bTip, aTip]],
			expected: { kind: 'fast-forward', oldOid: bTip, newOid: aTip, to: 'B' }
		},
		{
			name: 'both diverged',
			baseline: { a: base, b: base },
			a: aTip,
			b: bTip,
			expected: { kind: 'conflict', reason: 'diverged' }
		},
		{
			name: 'new ref exists only on A',
			baseline: { a: null, b: null },
			a: aTip,
			b: null,
			expected: { kind: 'create', newOid: aTip, to: 'B' }
		},
		{
			name: 'both deleted',
			baseline: { a: base, b: base },
			a: null,
			b: null,
			expected: { kind: 'noop' }
		},
		{
			name: 'A deleted and B stayed at baseline',
			baseline: { a: base, b: base },
			a: null,
			b: base,
			expected: { kind: 'delete', oldOid: base, from: 'B' }
		},
		{
			name: 'A deleted while B changed',
			baseline: { a: base, b: base },
			a: null,
			b: bTip,
			expected: { kind: 'conflict', reason: 'delete-modify' }
		}
	];

	it.each(cases)('$name', async ({ baseline, a, b, ancestors = [], expected }) => {
		const action = await planTwoWayRef(branch, baseline, a, b, ancestry(...ancestors));
		expect(action).toMatchObject({ ref: branch, ...expected });
	});

	it('requires safety handling for a changed tag', async () => {
		const action = await planTwoWayRef(tag, { a: base, b: base }, aTip, base, ancestry());
		expect(action).toMatchObject({ kind: 'force-update', to: 'B' });
		expect(assessAction(action, { strategy: 'approve-destructive', requireBackup: true })).toEqual({
			disposition: 'await-approval',
			requiresBackup: true,
			destructive: true
		});
	});

	it('never emits a write to A for one-way plans', async () => {
		const combinations: readonly (readonly [MaybeOid, MaybeOid])[] = [
			[null, null],
			[aTip, null],
			[aTip, base],
			[null, base]
		];
		for (const [a, b] of combinations) {
			const action = await planOneWayRef(
				branch,
				a,
				b,
				'delete-with-approval',
				ancestry([base, aTip])
			);
			expect('to' in action ? action.to : 'from' in action ? action.from : 'B').not.toBe('A');
		}
	});

	it('marks every force/delete action destructive', () => {
		const actions = [
			{ kind: 'force-update', ref: branch, oldOid: base, newOid: aTip, to: 'B' },
			{ kind: 'delete', ref: branch, oldOid: base, from: 'B' }
		] as const;
		for (const action of actions) expect(isDestructive(action)).toBe(true);
	});
});
