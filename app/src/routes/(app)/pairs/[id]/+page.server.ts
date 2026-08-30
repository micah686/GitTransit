import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { database } from '$lib/server/persistence/database';
import { pairService } from '$lib/server/application/pair-service';
import { pairRunService } from '$lib/server/application/pair-run-service';
import { JobQueue } from '$lib/server/jobs/queue';
export const load: PageServerLoad = ({ params, locals }) => {
	const pair = pairService()
		.list(locals.user!.id)
		.find((p) => p.id === params.id);
	if (!pair) error(404, { message: 'Pair not found', code: 'NOT_FOUND' });
	const routes = database()
		.prepare(
			`SELECT id,status,planned_namespace namespace,planned_name name,warning_summary warning FROM repository_routes WHERE pair_id=? AND user_id=? ORDER BY planned_namespace,planned_name`
		)
		.all(params.id, locals.user!.id) as Array<{
		id: string;
		status: string;
		namespace: string;
		name: string;
		warning: string | null;
	}>;
	return { pair, routes };
};
export const actions: Actions = {
	run: async ({ params, locals }) => {
		try {
			return { queued: pairRunService().enqueue(locals.user!.id, params.id).length };
		} catch (e) {
			return fail(409, { error: e instanceof Error ? e.message : 'Run failed.' });
		}
	},
	refresh: async ({ params, locals }) => {
		const row = database()
			.prepare('SELECT side_a_connection_id FROM mirror_pairs WHERE id=? AND user_id=?')
			.get(params.id, locals.user!.id) as { side_a_connection_id: string } | undefined;
		if (!row) return fail(404, { error: 'Pair not found.' });
		const runId = new JobQueue(database()).enqueue({
			ownerId: locals.user!.id,
			pairId: params.id,
			kind: 'discover',
			trigger: 'manual',
			idempotencyKey: `pair-discover:${params.id}:${crypto.randomUUID()}`,
			steps: [
				{ name: 'discover-provider', checkpoint: { connectionId: row.side_a_connection_id } },
				{ name: 'propose-routes', checkpoint: { pairId: params.id } }
			]
		});
		return { runId };
	}
};
