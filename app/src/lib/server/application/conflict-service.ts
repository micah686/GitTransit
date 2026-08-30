import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '../persistence/database';
import { database } from '../persistence/database';
import { JobQueue } from '../jobs/queue';
export interface ConflictSummary {
	id: string;
	routeId: string;
	runId: string;
	refName: string;
	kind: string;
	baselineA: string | null;
	baselineB: string | null;
	currentA: string | null;
	currentB: string | null;
	state: string;
	createdAt: number;
	pairName: string;
	sourcePath: string;
	targetPath: string;
	sourceProvider: string;
	targetProvider: string;
}
export type ConflictResolution =
	| { winner: 'A' | 'B' | 'external' }
	| { kind: 'commit'; oid: string }
	| { kind: 'keep-both'; winner: 'A' | 'B'; newRef: string };
export class ConflictService {
	constructor(private readonly db: SqliteDatabase) {}
	list(ownerId: string, state = 'open'): readonly ConflictSummary[] {
		return this.db
			.prepare(
				`SELECT c.id,c.route_id routeId,c.run_id runId,c.ref_name refName,c.kind,c.baseline_a baselineA,c.baseline_b baselineB,c.current_a currentA,c.current_b currentB,c.state,c.created_at createdAt,p.name pairName,a.canonical_full_path sourcePath,b.canonical_full_path targetPath,ca.provider_id sourceProvider,cb.provider_id targetProvider FROM conflicts c JOIN repository_routes r ON r.id=c.route_id AND r.user_id=c.user_id JOIN mirror_pairs p ON p.id=r.pair_id JOIN route_endpoints a ON a.route_id=r.id AND a.side='A' JOIN route_endpoints b ON b.route_id=r.id AND b.side='B' JOIN connections ca ON ca.id=a.connection_id JOIN connections cb ON cb.id=b.connection_id WHERE c.user_id=? AND (? IS NULL OR c.state=?) ORDER BY c.created_at DESC`
			)
			.all(ownerId, state || null, state || null) as ConflictSummary[];
	}
	get(ownerId: string, id: string): ConflictSummary | null {
		return this.list(ownerId, '').find((item) => item.id === id) ?? null;
	}
	resolve(ownerId: string, id: string, resolution: ConflictResolution): string {
		const conflict = this.get(ownerId, id);
		if (!conflict || conflict.state !== 'open')
			throw new Error('Conflict is unavailable or already resolved.');
		const pair = this.db
			.prepare('SELECT pair_id FROM repository_routes WHERE id=? AND user_id=?')
			.get(conflict.routeId, ownerId) as { pair_id: string } | undefined;
		if (!pair) throw new Error('Conflict route is unavailable.');
		if ('kind' in resolution && resolution.kind === 'commit') {
			if (!conflict.refName.startsWith('refs/heads/') || !/^[0-9a-f]{40,64}$/i.test(resolution.oid))
				throw new Error('Specify a full reachable commit ID for a branch conflict.');
			resolution = { kind: 'commit', oid: resolution.oid.toLowerCase() };
		}
		if ('kind' in resolution && resolution.kind === 'keep-both') {
			if (
				!['A', 'B'].includes(resolution.winner) ||
				!conflict.refName.startsWith('refs/heads/') ||
				!/^refs\/heads\/[A-Za-z0-9._/-]+$/.test(resolution.newRef) ||
				resolution.newRef === conflict.refName
			)
				throw new Error('Choose a different valid branch name for the preserved tip.');
		}
		const key =
			'kind' in resolution
				? resolution.kind === 'commit'
					? `commit:${resolution.oid}`
					: `keep-both:${resolution.winner}:${resolution.newRef}`
				: `winner:${resolution.winner}`;
		return new JobQueue(this.db).enqueue({
			ownerId,
			pairId: pair.pair_id,
			routeId: conflict.routeId,
			kind: 'sync',
			trigger: 'conflict-resolution',
			idempotencyKey: `conflict:${id}:${key}:${randomUUID()}`,
			steps: [
				{
					name: 'sync-two-way',
					routeId: conflict.routeId,
					checkpoint: { conflictId: id, resolution: { ref: conflict.refName, ...resolution } }
				}
			]
		});
	}
}
let instance: ConflictService | undefined;
export function conflictService() {
	instance ??= new ConflictService(database());
	return instance;
}
