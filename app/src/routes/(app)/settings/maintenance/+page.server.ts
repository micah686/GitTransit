import type { Actions } from './$types';
import { maintenanceService } from '$lib/server/operations/maintenance';
export const actions: Actions = {
	preview: async ({ locals }) => ({
		result: await maintenanceService().cleanup(locals.user!.id, { dryRun: true })
	}),
	apply: async ({ locals }) => ({
		result: await maintenanceService().cleanup(locals.user!.id, { dryRun: false })
	})
};
