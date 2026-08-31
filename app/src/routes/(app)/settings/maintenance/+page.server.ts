import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { maintenanceService } from '$lib/server/operations/maintenance';
export const load: PageServerLoad = ({ locals }) => {
	if (locals.user!.role !== 'admin')
		error(403, { message: 'Administrator access required.', code: 'FORBIDDEN' });
	return { history: maintenanceService().history(locals.user!.id) };
};
export const actions: Actions = {
	preview: async ({ locals, request }) => {
		assertAdmin(locals.user!);
		return {
			result: await maintenanceService().cleanup(locals.user!.id, {
				dryRun: true,
				...retention(await request.formData())
			})
		};
	},
	apply: async ({ locals, request }) => {
		assertAdmin(locals.user!);
		return {
			result: await maintenanceService().cleanup(locals.user!.id, {
				dryRun: false,
				...retention(await request.formData())
			})
		};
	}
};
function assertAdmin(user: { role: string }): void {
	if (user.role !== 'admin')
		error(403, { message: 'Administrator access required.', code: 'FORBIDDEN' });
}
function retention(form: FormData) {
	return {
		runRetentionDays: Math.max(1, Math.min(3650, Number(form.get('runRetentionDays') ?? 90))),
		artifactRetentionDays: Math.max(
			1,
			Math.min(3650, Number(form.get('artifactRetentionDays') ?? 30))
		),
		artifactKeepNewest: Math.max(1, Math.min(100, Number(form.get('artifactKeepNewest') ?? 3)))
	};
}
