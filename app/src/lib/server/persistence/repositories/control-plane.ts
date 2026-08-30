import type { SqliteDatabase } from '../database';

export class ControlPlaneRepository {
	constructor(private readonly db: SqliteDatabase) {}

	getPair(ownerId: string, id: string): Readonly<Record<string, unknown>> | null {
		return (
			(this.db.prepare('SELECT * FROM mirror_pairs WHERE id=? AND user_id=?').get(id, ownerId) as
				Readonly<Record<string, unknown>> | undefined) ?? null
		);
	}

	getRoute(ownerId: string, id: string): Readonly<Record<string, unknown>> | null {
		return (
			(this.db
				.prepare(
					`SELECT r.* FROM repository_routes r JOIN mirror_pairs p ON p.id=r.pair_id
		 WHERE r.id=? AND r.user_id=? AND p.user_id=r.user_id`
				)
				.get(id, ownerId) as Readonly<Record<string, unknown>> | undefined) ?? null
		);
	}

	getRun(ownerId: string, id: string): Readonly<Record<string, unknown>> | null {
		return (
			(this.db.prepare('SELECT * FROM runs WHERE id=? AND user_id=?').get(id, ownerId) as
				Readonly<Record<string, unknown>> | undefined) ?? null
		);
	}

	getConflict(ownerId: string, id: string): Readonly<Record<string, unknown>> | null {
		return (
			(this.db
				.prepare(
					`SELECT c.* FROM conflicts c JOIN repository_routes r ON r.id=c.route_id
		 WHERE c.id=? AND c.user_id=? AND r.user_id=c.user_id`
				)
				.get(id, ownerId) as Readonly<Record<string, unknown>> | undefined) ?? null
		);
	}
}
