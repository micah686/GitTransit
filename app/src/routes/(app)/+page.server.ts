import type { PageServerLoad } from './$types';
import { database } from '$lib/server/persistence/database';

export const load: PageServerLoad = ({ locals }) => {
	const ownerId = locals.user!.id;
	const db = database();
	const count = (sql: string) => (db.prepare(sql).get(ownerId) as { count: number }).count;
	return {
		user: locals.user,
		counts: {
			connections: count('SELECT COUNT(*) AS count FROM connections WHERE user_id=?'),
			pairs: count('SELECT COUNT(*) AS count FROM mirror_pairs WHERE user_id=?'),
			routes: count('SELECT COUNT(*) AS count FROM repository_routes WHERE user_id=?'),
			conflicts: count("SELECT COUNT(*) AS count FROM conflicts WHERE user_id=? AND state='open'"),
			activeRuns: count(
				"SELECT COUNT(*) AS count FROM runs WHERE user_id=? AND state IN ('queued','running')"
			)
		}
	};
};
