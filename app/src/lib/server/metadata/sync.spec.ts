import { createHash, randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDatabase } from '../persistence/database';
import type { MetadataComponent, MetadataMode } from '../domain/types';
import type { MetadataAdapter } from '../providers/types';
import type { NormalizedMetadataRecord } from '../domain/metadata-contracts';
import { MetadataSyncService } from './sync';

let db: SqliteDatabase | undefined;
afterEach(() => db?.close());

const modes = (enabled: Partial<Record<MetadataComponent, MetadataMode>>) =>
	({
		topics: 'off',
		labels: 'off',
		milestones: 'off',
		issues: 'off',
		'change-requests': 'off',
		releases: 'off',
		wiki: 'off',
		...enabled
	}) as Record<MetadataComponent, MetadataMode>;

function fixture(database: SqliteDatabase) {
	const owner = randomUUID(),
		a = randomUUID(),
		b = randomUUID(),
		ra = randomUUID(),
		rb = randomUUID();
	const pair = randomUUID(),
		route = randomUUID(),
		now = Date.now();
	database
		.prepare('INSERT INTO users(id,email,password_hash,role,created_at)VALUES(?,?,?,?,?)')
		.run(owner, 'metadata@test.invalid', 'hash', 'admin', now);
	const connection = database.prepare(`INSERT INTO connections
	 (id,user_id,name,normalized_name,provider_id,base_url,created_at,updated_at)
	 VALUES (?,?,?,?, 'fake','https://fake.invalid',?,?)`);
	connection.run(a, owner, 'A', 'a', now, now);
	connection.run(b, owner, 'B', 'b', now, now);
	const repository = database.prepare(`INSERT INTO remote_repositories
	 (id,connection_id,external_id,name,full_path,normalized_full_path,fetch_url,push_url,last_observed_at,created_at,updated_at)
	 VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
	repository.run(
		ra,
		a,
		'ra',
		'repo',
		'source/repo',
		'source/repo',
		'https://fake.invalid/a.git',
		'https://fake.invalid/a.git',
		now,
		now,
		now
	);
	repository.run(
		rb,
		b,
		'rb',
		'repo',
		'target/repo',
		'target/repo',
		'https://fake.invalid/b.git',
		'https://fake.invalid/b.git',
		now,
		now,
		now
	);
	database
		.prepare(
			`INSERT INTO mirror_pairs
	 (id,user_id,name,side_a_connection_id,side_b_connection_id,direction,state,selection_policy_json,namespace_policy_json,content_policy_json,metadata_policy_json,safety_policy_json,schedule_policy_json,validation_status,created_at,updated_at)
	 VALUES (?,?,?,?,?,'one-way','enabled','{}','{}','{}','{}','{}','{}','valid',?,?)`
		)
		.run(pair, owner, 'Metadata', a, b, now, now);
	database
		.prepare(
			`INSERT INTO repository_routes
	 (id,pair_id,user_id,side_a_repository_id,side_b_repository_id,planned_namespace,planned_name,status,created_at,updated_at)
	 VALUES (?,?,?,?,?,'target','repo','ready',?,?)`
		)
		.run(route, pair, owner, ra, rb, now, now);
	return { route, a, b };
}

function record(component: MetadataComponent, id = 'source-1'): NormalizedMetadataRecord {
	const contentDigest = createHash('sha256').update(`${component}:${id}`).digest('hex');
	return {
		identity: {
			provider: 'source',
			connectionId: 'a',
			repositoryId: 'repo',
			component,
			externalId: id
		},
		kind: component,
		title: 'Imported item',
		body: 'Body',
		state: 'open',
		sourceUrl: new URL('https://source.invalid/item/1'),
		sourceAuthorDisplay: 'Source User',
		sourceCreatedAt: '2026-01-01T00:00:00Z',
		sourceUpdatedAt: '2026-01-02T00:00:00Z',
		fields: {},
		contentDigest
	};
}

function request(
	database: SqliteDatabase,
	component: MetadataComponent,
	mode: MetadataMode,
	source: MetadataAdapter,
	target: MetadataAdapter,
	releaseTagExists = () => true
) {
	const ids = fixture(database);
	return {
		...ids,
		input: {
			routeId: ids.route,
			sourceRepository: 'source/repo',
			targetRepository: 'target/repo',
			sourceConnectionId: ids.a,
			targetConnectionId: ids.b,
			sourceContext: { connectionId: ids.a, signal: AbortSignal.timeout(10_000) },
			targetContext: { connectionId: ids.b, signal: AbortSignal.timeout(10_000) },
			source,
			target,
			components: modes({ [component]: mode }),
			checkpoint: {},
			saveCheckpoint: () => {},
			releaseTagExists
		}
	};
}

describe('metadata sync', () => {
	it('is idempotent for every API metadata component', async () => {
		db = openDatabase(':memory:');
		let writes = 0;
		const components: MetadataComponent[] = [
			'topics',
			'labels',
			'milestones',
			'issues',
			'change-requests',
			'releases'
		];
		const source: MetadataAdapter = {
			supportedComponents: new Set(components),
			list: async (_context, _repository, component) => ({
				items: [
					component === 'releases'
						? { ...record(component), fields: { tag: 'v1', assets: [] } }
						: record(component)
				],
				nextCursor: null
			})
		};
		const target: MetadataAdapter = {
			supportedComponents: new Set(components),
			upsert: async (_c, _r, _item, _p, existing) => {
				writes += 1;
				return {
					targetExternalId: existing ?? 'target-1',
					targetUrl: new URL('https://target.invalid/1'),
					loss: { unsupportedFields: [], lossyFields: [], warnings: [] }
				};
			}
		};
		const ids = fixture(db);
		const input = {
			routeId: ids.route,
			sourceRepository: 'source/repo',
			targetRepository: 'target/repo',
			sourceConnectionId: ids.a,
			targetConnectionId: ids.b,
			sourceContext: { connectionId: ids.a, signal: AbortSignal.timeout(10_000) },
			targetContext: { connectionId: ids.b, signal: AbortSignal.timeout(10_000) },
			source,
			target,
			components: modes(Object.fromEntries(components.map((component) => [component, 'required']))),
			checkpoint: {},
			saveCheckpoint: () => {},
			releaseTagExists: () => true
		};
		const service = new MetadataSyncService(db);
		expect(await service.execute(input)).toMatchObject({ written: 6, unchanged: 0 });
		expect(await service.execute(input)).toMatchObject({ written: 0, unchanged: 6 });
		expect(writes).toBe(6);
	});

	it('checkpoints every completed provider page', async () => {
		db = openDatabase(':memory:');
		const checkpoints: Array<Record<string, unknown>> = [];
		const source: MetadataAdapter = {
			supportedComponents: new Set(['labels']),
			list: async (_context, _repository, _component, cursor) => ({
				items: [record('labels', cursor ? 'second' : 'first')],
				nextCursor: cursor ? null : '2'
			})
		};
		const target: MetadataAdapter = {
			supportedComponents: new Set(['labels']),
			upsert: async (_c, _r, item) => ({
				targetExternalId: `target:${item.identity.externalId}`,
				targetUrl: new URL('https://target.invalid/label'),
				loss: { unsupportedFields: [], lossyFields: [], warnings: [] }
			})
		};
		const { input } = request(db, 'labels', 'required', source, target);
		const result = await new MetadataSyncService(db).execute({
			...input,
			saveCheckpoint: (checkpoint) => checkpoints.push({ ...checkpoint })
		});
		expect(result.written).toBe(2);
		expect(checkpoints).toEqual([
			{ component: 'labels', cursor: '2', processed: 1 },
			{ component: 'labels', processed: 2 }
		]);
	});

	it('keeps optional failures as warnings but rejects required failures', async () => {
		db = openDatabase(':memory:');
		const source: MetadataAdapter = {
			supportedComponents: new Set(['labels']),
			list: async () => {
				throw new Error('rate budget exhausted');
			}
		};
		const target: MetadataAdapter = {
			supportedComponents: new Set(['labels']),
			upsert: async () => {
				throw new Error('unused');
			}
		};
		const optional = request(db, 'labels', 'on', source, target).input;
		expect(await new MetadataSyncService(db).execute(optional)).toMatchObject({
			warnings: ['labels: rate budget exhausted']
		});
		db.close();
		db = openDatabase(':memory:');
		const required = request(db, 'labels', 'required', source, target).input;
		await expect(new MetadataSyncService(db).execute(required)).rejects.toThrow(
			'rate budget exhausted'
		);
	});

	it('waits for a release tag before creating its release', async () => {
		db = openDatabase(':memory:');
		const release = { ...record('releases'), fields: { tag: 'v1.2.3', assets: [] } };
		const source: MetadataAdapter = {
			supportedComponents: new Set(['releases']),
			list: async () => ({ items: [release], nextCursor: null })
		};
		const target: MetadataAdapter = {
			supportedComponents: new Set(['releases']),
			upsert: async () => {
				throw new Error('must not write');
			}
		};
		const { input } = request(db, 'releases', 'required', source, target, () => false);
		await expect(new MetadataSyncService(db).execute(input)).rejects.toThrow(
			'waiting for transferred tag v1.2.3'
		);
	});
});
