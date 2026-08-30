import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { conflictService } from '$lib/server/application/conflict-service';
export const load: PageServerLoad = ({ params, locals }) => {
	const conflict = conflictService().get(locals.user!.id, params.id);
	if (!conflict) error(404, { code: 'NOT_FOUND', message: 'Conflict not found.' });
	return { conflict };
};
export const actions: Actions = {
	resolve: async ({ params, locals, request }) => {
		const data = await request.formData();
		const outcome = String(data.get('outcome') ?? '');
		const resolution = ['A', 'B', 'external'].includes(outcome)
			? { winner: outcome as 'A' | 'B' | 'external' }
			: outcome === 'commit'
				? { kind: 'commit' as const, oid: String(data.get('oid') ?? '') }
				: outcome === 'keep-both'
					? {
							kind: 'keep-both' as const,
							winner: String(data.get('keepWinner') ?? '') as 'A' | 'B',
							newRef: `refs/heads/${String(data.get('newBranch') ?? '')}`
						}
					: null;
		if (!resolution) return fail(400, { error: 'Choose a valid resolution.' });
		try {
			return {
				runId: conflictService().resolve(locals.user!.id, params.id, resolution)
			};
		} catch (error) {
			return fail(409, {
				error: error instanceof Error ? error.message : 'Resolution could not be queued.'
			});
		}
	}
};
