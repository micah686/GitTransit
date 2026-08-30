import { randomUUID } from 'node:crypto';
import type { ContentPolicy, SafetyPolicy } from '../../domain/types';
import type { SqliteDatabase } from '../database';
import { transaction } from '../database';

export interface ManualRouteInput {
	readonly ownerId: string;
	readonly name: string;
	readonly connectionAId: string;
	readonly connectionBId: string;
	readonly sourceUrl: string;
	readonly targetUrl: string;
	readonly sourcePath: string;
	readonly targetPath: string;
	readonly content: ContentPolicy;
	readonly safety: SafetyPolicy;
}

export interface ManualRouteSummary {
	readonly pairId: string;
	readonly pairName: string;
	readonly routeId: string;
	readonly sourcePath: string;
	readonly targetPath: string;
	readonly sourceUrl: string;
	readonly targetUrl: string;
	readonly status: string;
}

export class ManualRouteRepository {
	constructor(private readonly db: SqliteDatabase) {}

	list(ownerId: string): readonly ManualRouteSummary[] {
		return this.db
			.prepare(
				`SELECT p.id pairId,p.name pairName,r.id routeId,a.canonical_full_path sourcePath,
			 b.canonical_full_path targetPath,a.fetch_url sourceUrl,b.push_url targetUrl,r.status
			 FROM repository_routes r JOIN mirror_pairs p ON p.id=r.pair_id
			 JOIN route_endpoints a ON a.route_id=r.id AND a.side='A'
			 JOIN route_endpoints b ON b.route_id=r.id AND b.side='B'
			 WHERE r.user_id=? ORDER BY p.name,r.created_at`
			)
			.all(ownerId) as ManualRouteSummary[];
	}

	create(input: ManualRouteInput): { pairId: string; routeId: string } {
		return transaction(this.db, () => {
			const connections = this.db
				.prepare(
					`SELECT id FROM connections WHERE user_id=? AND enabled=1 AND provider_id='generic-git'
				 AND id IN (?,?)`
				)
				.all(input.ownerId, input.connectionAId, input.connectionBId) as { id: string }[];
			if (input.connectionAId === input.connectionBId || connections.length !== 2)
				throw new Error('Choose two different enabled generic Git connections.');
			const pairId = randomUUID();
			const routeId = randomUUID();
			const repositoryAId = this.#upsertManualRepository(
				input.connectionAId,
				input.sourcePath,
				input.sourceUrl
			);
			const repositoryBId = this.#upsertManualRepository(
				input.connectionBId,
				input.targetPath,
				input.targetUrl
			);
			const now = Date.now();
			this.db
				.prepare(
					`INSERT INTO mirror_pairs
				 (id,user_id,name,side_a_connection_id,side_b_connection_id,direction,state,
				 selection_policy_json,namespace_policy_json,content_policy_json,metadata_policy_json,
				 safety_policy_json,schedule_policy_json,capability_snapshot_json,validation_status,created_at,updated_at)
				 VALUES (?,?,?,?,?,'one-way','draft',?,?,?,?,?,?,?,'valid',?,?)`
				)
				.run(
					pairId,
					input.ownerId,
					input.name.trim(),
					input.connectionAId,
					input.connectionBId,
					JSON.stringify({ mode: 'selected', repositoryIds: [repositoryAId] }),
					JSON.stringify({ strategy: 'map', mappings: [] }),
					JSON.stringify(input.content),
					JSON.stringify({ authority: null, components: {}, changeRequests: 'off' }),
					JSON.stringify(input.safety),
					JSON.stringify({ enabled: false }),
					JSON.stringify({ git: true, targetCreation: false }),
					now,
					now
				);
			this.db
				.prepare(
					`INSERT INTO repository_routes
				 (id,pair_id,user_id,side_a_repository_id,side_b_repository_id,planned_namespace,planned_name,
				 policy_overrides_json,status,created_at,updated_at)
				 VALUES (?,?,?,?,?,'',?,'{}','ready',?,?)`
				)
				.run(
					routeId,
					pairId,
					input.ownerId,
					repositoryAId,
					repositoryBId,
					input.targetPath,
					now,
					now
				);
			const insertEndpoint = this.db.prepare(
				`INSERT INTO route_endpoints
			 (route_id,side,connection_id,remote_repository_id,canonical_full_path,fetch_url,push_url,
			 provider_identity,verified_at) VALUES (?,?,?,?,?,?,?,?,?)`
			);
			insertEndpoint.run(
				routeId,
				'A',
				input.connectionAId,
				repositoryAId,
				input.sourcePath,
				input.sourceUrl,
				input.sourceUrl,
				input.sourceUrl,
				now
			);
			insertEndpoint.run(
				routeId,
				'B',
				input.connectionBId,
				repositoryBId,
				input.targetPath,
				input.targetUrl,
				input.targetUrl,
				input.targetUrl,
				now
			);
			return { pairId, routeId };
		});
	}

	#upsertManualRepository(connectionId: string, fullPath: string, url: string): string {
		const normalized = fullPath.toLowerCase();
		const existing = this.db
			.prepare(
				'SELECT id FROM remote_repositories WHERE connection_id=? AND normalized_full_path=?'
			)
			.get(connectionId, normalized) as { id: string } | undefined;
		if (existing) return existing.id;
		const id = randomUUID();
		const now = Date.now();
		this.db
			.prepare(
				`INSERT INTO remote_repositories
			 (id,connection_id,name,full_path,normalized_full_path,fetch_url,push_url,discovery_state,
			 last_observed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'manual',?,?,?)`
			)
			.run(
				id,
				connectionId,
				fullPath.split('/').at(-1) ?? fullPath,
				fullPath,
				normalized,
				url,
				url,
				now,
				now,
				now
			);
		return id;
	}
}
