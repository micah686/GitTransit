import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDatabase } from '$lib/server/persistence/database';
import { appendEvent, EventStore } from './store';

let db: SqliteDatabase | undefined;
afterEach(() => db?.close());

describe('EventStore', () => {
	it('provides independent non-consuming cursors scoped to each owner', () => {
		db = openDatabase(':memory:');
		for (const [id, email] of [
			['owner-a', 'a@example.test'],
			['owner-b', 'b@example.test']
		]) {
			db.prepare(
				"INSERT INTO users (id,email,password_hash,role,created_at) VALUES (?,?,?,'member',0)"
			).run(id, email, 'hash');
		}
		appendEvent(db, 'owner-a', 'run.queued', ['run-a'], { state: 'queued' });
		appendEvent(db, 'owner-b', 'run.queued', ['run-b'], { state: 'queued' });
		const events = new EventStore(db);
		const tabOne = events.readAfter('owner-a', 0);
		const tabTwo = events.readAfter('owner-a', 0);
		expect(tabOne).toEqual(tabTwo);
		expect(tabOne[0]?.resourceIds).toEqual(['run-a']);
		expect(events.readAfter('owner-b', 0)[0]?.resourceIds).toEqual(['run-b']);
		expect(events.readAfter('owner-a', tabOne[0]!.cursor)).toEqual([]);
	});
});
