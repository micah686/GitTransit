import type { SqliteDatabase } from '../persistence/database';
import type {
	MetadataWriteResult,
	NormalizedMetadataRecord,
	RateLimitObservation
} from '../domain/metadata-contracts';

export interface MetadataMapping {
	readonly targetIdentity: string;
	readonly digest: string;
	readonly version: number;
}

export class MetadataStore {
	constructor(private readonly db: SqliteDatabase) {}

	mapping(routeId: string, record: NormalizedMetadataRecord): MetadataMapping | null {
		const row = this.db
			.prepare(
				`SELECT target_identity,digest,version FROM metadata_mappings
			 WHERE route_id=? AND component=? AND source_identity=?`
			)
			.get(routeId, record.kind, record.identity.externalId) as
			{ target_identity: string; digest: string; version: number } | undefined;
		return row
			? { targetIdentity: row.target_identity, digest: row.digest, version: row.version }
			: null;
	}

	record(
		routeId: string,
		record: NormalizedMetadataRecord,
		provenance: string,
		result: MetadataWriteResult
	): void {
		this.db
			.prepare(
				`INSERT INTO metadata_mappings
			 (route_id,component,source_identity,target_identity,provenance,digest,version,synced_at)
			 VALUES (?,?,?,?,?,?,1,?)
			 ON CONFLICT(route_id,component,source_identity) DO UPDATE SET
			 target_identity=excluded.target_identity,provenance=excluded.provenance,
			 digest=excluded.digest,version=metadata_mappings.version+1,synced_at=excluded.synced_at`
			)
			.run(
				routeId,
				record.kind,
				record.identity.externalId,
				result.targetExternalId,
				provenance,
				record.contentDigest,
				Date.now()
			);
	}

	recordRate(connectionId: string, observation: RateLimitObservation): void {
		this.db
			.prepare(
				`INSERT INTO rate_limits
			 (connection_id,category,limit_value,remaining,reset_at,retry_at,status,observed_at)
			 VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(connection_id,category) DO UPDATE SET
			 limit_value=excluded.limit_value,remaining=excluded.remaining,reset_at=excluded.reset_at,
			 retry_at=excluded.retry_at,status=excluded.status,observed_at=excluded.observed_at`
			)
			.run(
				connectionId,
				observation.category,
				observation.limit,
				observation.remaining,
				observation.resetAt,
				observation.retryAt,
				observation.status,
				Date.now()
			);
	}
}
