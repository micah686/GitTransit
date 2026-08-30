import { fail } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';
import { manualRouteService } from '$lib/server/application/manual-route-service';
import { JobQueue } from '$lib/server/jobs/queue';
import { database } from '$lib/server/persistence/database';

export const load: PageServerLoad = ({ locals }) => ({
	routes: manualRouteService().list(locals.user!.id)
});

export const actions: Actions = {
	run: async ({ request, locals }) => {
		const form = await request.formData();
		const routeId = String(form.get('routeId') ?? '');
		const route = manualRouteService()
			.list(locals.user!.id)
			.find((item) => item.routeId === routeId);
		if (!route) return fail(404, { error: 'Route not found.' });
		const runId = new JobQueue(database()).enqueue({
			ownerId: locals.user!.id,
			kind: 'sync',
			trigger: 'manual',
			idempotencyKey: `manual:${routeId}:${randomUUID()}`,
			pairId: route.pairId,
			routeId,
			steps: [{ name: 'sync-one-way', routeId }]
		});
		return { queued: true, runId };
	}
};
