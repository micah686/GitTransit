import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { inventoryService } from '$lib/server/application/inventory-service';
import { JobQueue } from '$lib/server/jobs/queue';
import { database } from '$lib/server/persistence/database';
export const load: PageServerLoad = ({ locals, url }) => {
	const pair = url.searchParams.get('pair');
	const status = url.searchParams.get('status');
	const direction = url.searchParams.get('direction');
	const text = url.searchParams.get('q');
	const filters = {
		...(pair ? { pair } : {}),
		...(status ? { status } : {}),
		...(direction ? { direction } : {}),
		...(text ? { text } : {})
	};
	return { routes: inventoryService().listRoutes(locals.user!.id, filters), filters };
};
export const actions: Actions = {
	run: async ({ request, locals }) => {
		const ids = (await request.formData()).getAll('routeId').map(String);
		if (!ids.length) return fail(400, { error: 'Select at least one route.' });
		const queue = new JobQueue(database());
		let queued = 0;
		for (const id of ids) {
			const route = inventoryService().getRoute(locals.user!.id, id) as {
				pairId: string;
				direction: string;
			} | null;
			if (!route || route.direction !== 'one-way') continue;
			queue.enqueue({
				ownerId: locals.user!.id,
				pairId: route.pairId,
				routeId: id,
				kind: 'sync',
				trigger: 'manual',
				idempotencyKey: `manual:${id}:${crypto.randomUUID()}`,
				steps: [{ name: 'sync-one-way', routeId: id }]
			});
			queued += 1;
		}
		return { queued };
	}
};
