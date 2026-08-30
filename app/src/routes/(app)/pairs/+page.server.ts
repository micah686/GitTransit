import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { pairService } from '$lib/server/application/pair-service';
import { pairRunService } from '$lib/server/application/pair-run-service';

export const load: PageServerLoad = ({ locals }) => ({
	pairs: pairService().list(locals.user!.id)
});
export const actions: Actions = {
	run: async ({ request, locals }) => mutate(await request.formData(), locals.user!.id, 'run'),
	enable: async ({ request, locals }) =>
		mutate(await request.formData(), locals.user!.id, 'enabled'),
	pause: async ({ request, locals }) => mutate(await request.formData(), locals.user!.id, 'paused')
};
function mutate(form: FormData, ownerId: string, action: 'run' | 'enabled' | 'paused') {
	const pairId = String(form.get('pairId') ?? '');
	try {
		if (action === 'run') return { queued: pairRunService().enqueue(ownerId, pairId).length };
		if (!pairRunService().setState(ownerId, pairId, action))
			return fail(404, { error: 'Pair not found or not valid.' });
		return { updated: true };
	} catch (error) {
		return fail(409, { error: error instanceof Error ? error.message : 'Unable to update pair.' });
	}
}
