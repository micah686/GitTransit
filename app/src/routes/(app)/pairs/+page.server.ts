import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	manualRouteService,
	type ManualRouteValues
} from '$lib/server/application/manual-route-service';
import { appPath } from '$lib/server/config';

export const load: PageServerLoad = ({ locals }) => ({
	connections: manualRouteService().listConnections(locals.user!.id),
	routes: manualRouteService().list(locals.user!.id)
});

function values(form: FormData): ManualRouteValues {
	return {
		name: String(form.get('name') ?? ''),
		connectionAId: String(form.get('connectionAId') ?? ''),
		connectionBId: String(form.get('connectionBId') ?? ''),
		sourceUrl: String(form.get('sourceUrl') ?? ''),
		targetUrl: String(form.get('targetUrl') ?? ''),
		targetOnly: String(form.get('targetOnly') ?? 'preserve') as ManualRouteValues['targetOnly'],
		safety: String(form.get('safety') ?? 'fast-forward-only') as ManualRouteValues['safety'],
		lfs: String(form.get('lfs') ?? 'off') as ManualRouteValues['lfs'],
		wiki: form.get('wiki') === 'on'
	};
}

function validOptions(input: ManualRouteValues): boolean {
	return (
		['preserve', 'delete-with-approval', 'error'].includes(input.targetOnly) &&
		['fast-forward-only', 'backup-and-apply'].includes(input.safety) &&
		['off', 'auto', 'on'].includes(input.lfs)
	);
}

export const actions: Actions = {
	preview: async ({ request, locals }) => {
		const input = values(await request.formData());
		if (!validOptions(input)) return fail(400, { values: input, error: 'Choose valid policies.' });
		try {
			return { values: input, preview: await manualRouteService().preview(locals.user!.id, input) };
		} catch (error) {
			return fail(400, {
				values: input,
				error: error instanceof Error ? error.message : 'Unable to preview these endpoints.'
			});
		}
	},
	save: async ({ request, locals }) => {
		const input = values(await request.formData());
		if (!validOptions(input)) return fail(400, { values: input, error: 'Choose valid policies.' });
		try {
			await manualRouteService().create(locals.user!.id, input);
		} catch (error) {
			return fail(400, {
				values: input,
				error: error instanceof Error ? error.message : 'Unable to save this manual route.'
			});
		}
		redirect(303, appPath('/repositories'));
	}
};
