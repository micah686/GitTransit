import type { PageServerLoad } from './$types';
import { inventoryService } from '$lib/server/application/inventory-service';
export const load: PageServerLoad = ({ locals, url }) => ({
	runs: inventoryService().listRuns(locals.user!.id, url.searchParams.get('state') ?? undefined),
	state: url.searchParams.get('state') ?? ''
});
