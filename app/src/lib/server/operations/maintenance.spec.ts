import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDatabase } from '../persistence/database';
import { ManualRouteRepository } from '../persistence/repositories/manual-routes';
import { MaintenanceService } from './maintenance';
let db: SqliteDatabase | undefined;
afterEach(() => db?.close());
describe('retention cleanup', () => {
	it('previews without mutation and preserves the newest verified artifacts', async () => {
		db = openDatabase(':memory:');
		const owner = randomUUID(),
			now = Date.now(),
			a = randomUUID(),
			b = randomUUID();
		db.prepare('INSERT INTO users(id,email,password_hash,role,created_at)VALUES(?,?,?,?,?)').run(
			owner,
			'cleanup@test.invalid',
			'h',
			'admin',
			now
		);
		const connection = db.prepare(
			`INSERT INTO connections(id,user_id,name,normalized_name,provider_id,base_url,capabilities_json,created_at,updated_at)VALUES(?,?,?,?, 'generic-git',?,'[]',?,?)`
		);
		connection.run(a, owner, 'A', 'a', 'https://a.test', now, now);
		connection.run(b, owner, 'B', 'b', 'https://b.test', now, now);
		const route = new ManualRouteRepository(db).create({
			ownerId: owner,
			name: 'Retention',
			connectionAId: a,
			connectionBId: b,
			sourceUrl: 'https://a.test/r.git',
			targetUrl: 'https://b.test/r.git',
			sourcePath: 'r',
			targetPath: 'r',
			content: {
				refs: { includes: [], excludes: [], targetOnly: 'preserve' },
				lfs: 'off',
				wiki: 'off'
			},
			safety: { strategy: 'backup-and-apply', requireBackup: true }
		});
		for (let index = 0; index < 5; index += 1) {
			const run = randomUUID(),
				created = now - (40 + index) * 86_400_000;
			db.prepare(
				`INSERT INTO runs(id,user_id,pair_id,route_id,trigger,kind,state,idempotency_key,requested_at,completed_at)VALUES(?,?,?,?,'manual','sync','succeeded',?,?,?)`
			).run(run, owner, route.pairId, route.routeId, run, created, created);
			db.prepare(
				`INSERT INTO backup_artifacts(id,user_id,route_id,run_id,protected_side,relative_path,byte_size,digest,manifest_json,verification_status,created_at,expires_at)VALUES(?,?,?,?,'B',?,10,?,'{}','verified',?,?)`
			).run(
				randomUUID(),
				owner,
				route.routeId,
				run,
				`backups/${route.routeId}/${run}.bundle`,
				String(index).padStart(64, '0'),
				created,
				created + 30 * 86_400_000
			);
		}
		const service = new MaintenanceService(db);
		expect((await service.cleanup(owner, { dryRun: true, now })).artifacts).toBe(2);
		expect(
			(db.prepare('SELECT COUNT(*) count FROM backup_artifacts').get() as { count: number }).count
		).toBe(5);
		expect((await service.cleanup(owner, { dryRun: false, now })).artifacts).toBe(2);
		expect(
			(db.prepare('SELECT COUNT(*) count FROM backup_artifacts').get() as { count: number }).count
		).toBe(3);
	});
});
