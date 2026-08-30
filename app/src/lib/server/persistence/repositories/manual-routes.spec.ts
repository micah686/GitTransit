import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../database';
import { ManualRouteRepository } from './manual-routes';

describe('manual route repository', () => {
	it('creates an owner-scoped ready route between different preconfigured connections', () => {
		const db = openDatabase(':memory:');
		try {
			const ownerId = randomUUID();
			const now = Date.now();
			db.prepare(
				'INSERT INTO users(id,email,password_hash,role,created_at) VALUES (?,?,?,?,?)'
			).run(ownerId, 'manual@example.test', 'hash', 'admin', now);
			const insertConnection = db.prepare(`INSERT INTO connections
			 (id,user_id,name,normalized_name,provider_id,base_url,capabilities_json,created_at,updated_at)
			 VALUES (?,?,?,?, 'generic-git',?,'["git:fetch","git:push"]',?,?)`);
			const a = randomUUID();
			const b = randomUUID();
			insertConnection.run(a, ownerId, 'Source', 'source', 'https://source.example', now, now);
			insertConnection.run(b, ownerId, 'Target', 'target', 'https://target.example', now, now);
			const repository = new ManualRouteRepository(db);
			const created = repository.create({
				ownerId,
				name: 'Docs',
				connectionAId: a,
				connectionBId: b,
				sourceUrl: 'https://source.example/team/docs.git',
				targetUrl: 'https://target.example/archive/docs.git',
				sourcePath: 'team/docs',
				targetPath: 'archive/docs',
				content: {
					refs: { includes: ['refs/heads/*'], excludes: [], targetOnly: 'preserve' },
					lfs: 'off',
					wiki: 'off'
				},
				safety: { strategy: 'fast-forward-only', requireBackup: false }
			});
			expect(repository.list(ownerId)).toEqual([
				expect.objectContaining({
					pairId: created.pairId,
					routeId: created.routeId,
					status: 'ready'
				})
			]);
			expect(repository.list(randomUUID())).toEqual([]);
			expect(() =>
				repository.create({
					ownerId,
					name: 'Invalid',
					connectionAId: a,
					connectionBId: a,
					sourceUrl: 'https://source.example/a.git',
					targetUrl: 'https://source.example/b.git',
					sourcePath: 'a',
					targetPath: 'b',
					content: {
						refs: { includes: [], excludes: [], targetOnly: 'preserve' },
						lfs: 'off',
						wiki: 'off'
					},
					safety: { strategy: 'fast-forward-only', requireBackup: false }
				})
			).toThrow('different');
		} finally {
			db.close();
		}
	});
});
