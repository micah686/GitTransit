import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { inventoryService } from '$lib/server/application/inventory-service';
export const load: PageServerLoad = ({ params, locals }) => {
	const route = inventoryService().getRoute(locals.user!.id, params.id);
	if (!route) error(404, { message: 'Route not found', code: 'NOT_FOUND' });
	return { route };
};
