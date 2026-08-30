import type {
	MaybeOid,
	Oid,
	RefAction,
	RefBaseline,
	RefMap,
	RefName,
	Side,
	TargetOnlyRefPolicy
} from './types';

export type AncestryCheck = (older: Oid, newer: Oid) => Promise<boolean>;

const equal = (left: MaybeOid, right: MaybeOid): boolean => left === right;
const isTag = (ref: RefName): boolean => ref.startsWith('refs/tags/');

async function propagationAction(
	ref: RefName,
	value: MaybeOid,
	target: MaybeOid,
	to: Side,
	isAncestor: AncestryCheck
): Promise<RefAction> {
	if (value === null) {
		if (target === null) return { kind: 'noop', ref };
		return { kind: 'delete', ref, oldOid: target, from: to };
	}
	if (target === null) return { kind: 'create', ref, newOid: value, to };
	if (value === target) return { kind: 'noop', ref, oid: value };
	if (!isTag(ref) && (await isAncestor(target, value))) {
		return { kind: 'fast-forward', ref, oldOid: target, newOid: value, to };
	}
	return { kind: 'force-update', ref, oldOid: target, newOid: value, to };
}

export async function planOneWayRef(
	ref: RefName,
	a: MaybeOid,
	b: MaybeOid,
	targetOnly: TargetOnlyRefPolicy,
	isAncestor: AncestryCheck
): Promise<RefAction> {
	if (a !== null) return propagationAction(ref, a, b, 'B', isAncestor);
	if (b === null || targetOnly === 'preserve')
		return { kind: 'noop', ref, ...(b ? { oid: b } : {}) };
	if (targetOnly === 'error') return { kind: 'conflict', ref, reason: 'destination-mismatch' };
	return { kind: 'delete', ref, oldOid: b, from: 'B' };
}

export async function planOneWayRefs(
	a: RefMap,
	b: RefMap,
	targetOnly: TargetOnlyRefPolicy,
	isAncestor: AncestryCheck
): Promise<readonly RefAction[]> {
	const refs = new Set<RefName>([...a.keys(), ...b.keys()]);
	const actions: RefAction[] = [];
	for (const ref of [...refs].sort()) {
		actions.push(
			await planOneWayRef(ref, a.get(ref) ?? null, b.get(ref) ?? null, targetOnly, isAncestor)
		);
	}
	return actions;
}

export async function planTwoWayRef(
	ref: RefName,
	baseline: RefBaseline,
	a: MaybeOid,
	b: MaybeOid,
	isAncestor: AncestryCheck
): Promise<RefAction> {
	if (equal(a, b)) return { kind: 'noop', ref, ...(a ? { oid: a } : {}) };

	const aChanged = !equal(a, baseline.a);
	const bChanged = !equal(b, baseline.b);
	if (!aChanged && !bChanged) return { kind: 'noop', ref, ...(a ? { oid: a } : {}) };
	if (aChanged && !bChanged) return propagationAction(ref, a, b, 'B', isAncestor);
	if (!aChanged && bChanged) return propagationAction(ref, b, a, 'A', isAncestor);

	if (a === null || b === null) return { kind: 'conflict', ref, reason: 'delete-modify' };
	if (isTag(ref)) return { kind: 'conflict', ref, reason: 'tag-rewrite' };
	if (await isAncestor(a, b)) {
		return { kind: 'fast-forward', ref, oldOid: a, newOid: b, to: 'A' };
	}
	if (await isAncestor(b, a)) {
		return { kind: 'fast-forward', ref, oldOid: b, newOid: a, to: 'B' };
	}
	return { kind: 'conflict', ref, reason: 'diverged' };
}

export async function planTwoWayRefs(
	baselines: ReadonlyMap<RefName, RefBaseline>,
	a: RefMap,
	b: RefMap,
	isAncestor: AncestryCheck
): Promise<readonly RefAction[]> {
	const refs = new Set<RefName>([...baselines.keys(), ...a.keys(), ...b.keys()]);
	const actions: RefAction[] = [];
	for (const ref of [...refs].sort()) {
		const baseline = baselines.get(ref) ?? { a: null, b: null };
		actions.push(
			await planTwoWayRef(ref, baseline, a.get(ref) ?? null, b.get(ref) ?? null, isAncestor)
		);
	}
	return actions;
}
