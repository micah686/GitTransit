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
	const policyRow = database()
		.prepare(
			`SELECT metadata_policy_json,a.capabilities_json a_capabilities,b.capabilities_json b_capabilities,
			 a.id a_connection_id,b.id b_connection_id
			 FROM mirror_pairs p JOIN connections a ON a.id=p.side_a_connection_id
			 JOIN connections b ON b.id=p.side_b_connection_id WHERE p.id=? AND p.user_id=?`
		)
		.get(params.id, locals.user!.id) as {
		metadata_policy_json: string;
		a_capabilities: string;
		b_capabilities: string;
		a_connection_id: string;
		b_connection_id: string;
	};
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
	const mappings = database()
		.prepare(
			`SELECT component,COUNT(*) itemCount,MAX(synced_at) lastSyncedAt
			 FROM metadata_mappings WHERE route_id IN
			 (SELECT id FROM repository_routes WHERE pair_id=? AND user_id=?) GROUP BY component`
		)
		.all(params.id, locals.user!.id) as Array<{
		component: string;
		itemCount: number;
		lastSyncedAt: number;
	}>;
	const rateLimits = database()
		.prepare(
			`SELECT category,remaining,limit_value limitValue,reset_at resetAt,status
			 FROM rate_limits WHERE connection_id IN (?,?) ORDER BY observed_at DESC`
		)
		.all(policyRow.a_connection_id, policyRow.b_connection_id) as Array<{
		category: string;
		remaining: number | null;
		limitValue: number | null;
		resetAt: number | null;
		status: string;
	}>;
	return {
		pair,
		routes,
		metadata: {
			policy: JSON.parse(policyRow.metadata_policy_json) as {
				authority: 'A' | null;
				components: Record<string, 'off' | 'on' | 'required'>;
			},
			mappings,
			rateLimits
		}
	};
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
