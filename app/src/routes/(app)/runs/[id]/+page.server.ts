import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { inventoryService } from '$lib/server/application/inventory-service';
export const load: PageServerLoad = ({ params, locals }) => {
	const detail = inventoryService().getRun(locals.user!.id, params.id);
	if (!detail) error(404, { message: 'Run not found', code: 'NOT_FOUND' });
	return detail;
};
