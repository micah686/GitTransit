import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDatabase } from './database';
import { LeaseRepository } from './repositories/leases';
let db: SqliteDatabase | undefined;
afterEach(() => db?.close());
describe('scheduler leadership', () => {
	it('permits only one live scheduler lease holder', () => {
		db = openDatabase(':memory:');
		const leases = new LeaseRepository(db);
		const leader = leases.acquire('scheduler', 'global', 'worker-a', 60_000);
		expect(leader).not.toBeNull();
		expect(leases.acquire('scheduler', 'global', 'worker-b', 60_000)).toBeNull();
		expect(leases.heartbeat(leader!, 60_000)).toBe(true);
		expect(leases.release(leader!)).toBe(true);
		expect(leases.acquire('scheduler', 'global', 'worker-b', 60_000)).not.toBeNull();
	});
});
