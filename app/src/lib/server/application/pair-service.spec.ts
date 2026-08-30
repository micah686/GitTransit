import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDatabase } from '../persistence/database';
import type { PairValues } from './pair-service';
import { nextSchedule, PairService } from './pair-service';

let db: SqliteDatabase | undefined;
afterEach(() => db?.close());

function fixture() {
	db = openDatabase(':memory:');
	const ownerId = randomUUID();
	const sourceId = randomUUID();
	const targetId = randomUUID();
	const now = Date.now();
	db.prepare('INSERT INTO users(id,email,password_hash,role,created_at) VALUES (?,?,?,?,?)').run(
		ownerId,
		'pair@example.test',
		'hash',
		'admin',
		now
	);
	const insertConnection = db.prepare(`INSERT INTO connections
	 (id,user_id,name,normalized_name,provider_id,base_url,capabilities_json,created_at,updated_at)
	 VALUES (?,?,?,?, 'fake',?, ?,?,?)`);
	const capabilities = JSON.stringify([
		'repository:list',
		'repository:create',
		'git:fetch',
		'git:push'
	]);
	insertConnection.run(
		sourceId,
		ownerId,
		'Source',
		'source',
		'https://source.test',
		capabilities,
		now,
		now
	);
	insertConnection.run(
		targetId,
		ownerId,
		'Target',
		'target',
		'https://target.test',
		capabilities,
		now,
		now
	);
	const repositoryId = randomUUID();
	db.prepare(
		`INSERT INTO remote_repositories
	 (id,connection_id,external_id,name,full_path,normalized_full_path,fetch_url,push_url,last_observed_at,created_at,updated_at)
	 VALUES (?,?,?,?,?,?,?,?,?,?,?)`
	).run(
		repositoryId,
		sourceId,
		'source-1',
		'docs',
		'Team/Docs',
		'team/docs',
		'https://source.test/Team/Docs.git',
		'https://source.test/Team/Docs.git',
		now,
		now,
		now
	);
	const values: PairValues = {
		name: 'Documentation',
		connectionAId: sourceId,
		connectionBId: targetId,
		direction: 'one-way',
		selection: {
			mode: 'all',
			repositoryIds: [],
			includes: [],
			excludes: [],
			includeArchived: false,
			forkPolicy: 'skip',
			extensions: {}
		},
		namespace: { strategy: 'preserve', mappings: [] },
		content: {
			refs: { includes: ['refs/heads/*', 'refs/tags/*'], excludes: [], targetOnly: 'preserve' },
			lfs: 'off',
			wiki: 'off'
		},
		safety: { strategy: 'fast-forward-only', requireBackup: false },
		schedule: {
			enabled: false,
			expression: { kind: 'duration', value: '6h' },
			timezone: 'UTC',
			inventoryExpression: '24h',
			batchSize: 20,
			routeConcurrency: 2,
			retryAttempts: 3,
			operationTimeoutMs: 120000
		},
		autoProvision: true,
		collisionStrategy: 'block',
		initialBaselineMode: 'require-equality'
	};
	return { ownerId, sourceId, values };
}

describe('pair product', () => {
	it('previews without mutation and saves collision-aware route proposals', () => {
		const { ownerId, sourceId, values } = fixture();
		const service = new PairService(db!);
		const preview = service.preview(ownerId, values);
		expect(preview.proposals).toEqual([
			expect.objectContaining({
				sourcePath: 'Team/Docs',
				targetPath: 'Team/Docs',
				action: 'create'
			})
		]);
		expect(
			(db!.prepare('SELECT COUNT(*) count FROM mirror_pairs').get() as { count: number }).count
		).toBe(0);
		const pairId = service.create(ownerId, values);
		expect(service.list(ownerId)).toEqual([expect.objectContaining({ id: pairId, routeCount: 1 })]);
		expect(() => service.preview(ownerId, { ...values, connectionBId: sourceId })).toThrow(
			'different'
		);
	});

	it('persists the canonical endpoint once and reuses it on provisioning retry', async () => {
		const { ownerId, values } = fixture();
		const service = new PairService(db!);
		const pairId = service.create(ownerId, values);
		const route = db!.prepare('SELECT id FROM repository_routes WHERE pair_id=?').get(pairId) as {
			id: string;
		};
		expect(await service.provision(ownerId, route.id, AbortSignal.timeout(1000))).toEqual({
			created: false,
			path: 'Team/Docs'
		});
		expect(await service.provision(ownerId, route.id, AbortSignal.timeout(1000))).toEqual({
			created: false,
			path: 'Team/Docs'
		});
		expect(
			(
				db!
					.prepare('SELECT COUNT(*) count FROM remote_repositories WHERE connection_id=?')
					.get(values.connectionBId) as { count: number }
			).count
		).toBe(1);
	});

	it('calculates bounded duration schedules', () => {
		const { values } = fixture();
		const from = new Date('2026-01-01T00:00:00Z');
		expect(nextSchedule({ ...values.schedule, enabled: true }, from)).toBe(
			from.getTime() + 21_600_000
		);
	});
});
