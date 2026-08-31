import type { SqliteDatabase } from '$lib/server/persistence/database';

const EVENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface SafeEvent {
	cursor: number;
	type: string;
	resourceIds: readonly string[];
	payload: Readonly<Record<string, unknown>>;
	createdAt: number;
}

interface EventRow {
	cursor: number;
	event_type: string;
	resource_ids_json: string;
	payload_json: string;
	created_at: number;
}

export function appendEvent(
	db: SqliteDatabase,
	ownerId: string,
	type: string,
	resourceIds: readonly string[],
	payload: Readonly<Record<string, unknown>>,
	now = Date.now()
): number {
	const result = db
		.prepare(
			`INSERT INTO events
	 (user_id,event_type,resource_ids_json,payload_json,created_at,expires_at) VALUES (?,?,?,?,?,?)`
		)
		.run(
			ownerId,
			type,
			JSON.stringify(resourceIds),
			JSON.stringify(payload),
			now,
			now + EVENT_RETENTION_MS
		);
	const cursor = Number(result.lastInsertRowid);
	db.prepare(
		`INSERT OR IGNORE INTO notification_deliveries
	 (id,endpoint_id,user_id,event_cursor,event_type,payload_json,state,next_attempt_at,created_at,updated_at)
	 SELECT lower(hex(randomblob(16))),id,user_id,?,?,?,'queued',?,?,? FROM notification_endpoints
	 WHERE user_id=? AND enabled=1 AND EXISTS
	 (SELECT 1 FROM json_each(event_filters_json) WHERE value=?)`
	).run(
		cursor,
		type,
		JSON.stringify({ type, resourceIds, payload, createdAt: now }),
		now,
		now,
		now,
		ownerId,
		type
	);
	return cursor;
}

export class EventStore {
	constructor(private readonly db: SqliteDatabase) {}

	readAfter(ownerId: string, cursor: number, limit = 100): readonly SafeEvent[] {
		const rows = this.db
			.prepare(
				`SELECT cursor,event_type,resource_ids_json,payload_json,created_at
		 FROM events WHERE user_id=? AND cursor>? ORDER BY cursor LIMIT ?`
			)
			.all(ownerId, cursor, limit) as EventRow[];
		return rows.map((row) => ({
			cursor: row.cursor,
			type: row.event_type,
			resourceIds: JSON.parse(row.resource_ids_json) as string[],
			payload: JSON.parse(row.payload_json) as Record<string, unknown>,
			createdAt: row.created_at
		}));
	}

	latestCursor(ownerId: string): number {
		return (
			this.db
				.prepare('SELECT COALESCE(MAX(cursor),0) AS cursor FROM events WHERE user_id=?')
				.get(ownerId) as { cursor: number }
		).cursor;
	}

	oldestCursor(ownerId: string): number | null {
		return (
			this.db.prepare('SELECT MIN(cursor) AS cursor FROM events WHERE user_id=?').get(ownerId) as {
				cursor: number | null;
			}
		).cursor;
	}

	prune(now = Date.now()): number {
		return this.db.prepare('DELETE FROM events WHERE expires_at<=?').run(now).changes;
	}
}
