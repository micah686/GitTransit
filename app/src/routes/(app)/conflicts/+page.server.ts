import type { PageServerLoad } from './$types';
import { conflictService } from '$lib/server/application/conflict-service';
export const load: PageServerLoad = ({ locals }) => ({
	conflicts: conflictService().list(locals.user!.id)
});
