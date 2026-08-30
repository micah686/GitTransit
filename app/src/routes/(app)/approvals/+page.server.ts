import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { approvalService } from '$lib/server/safety/approvals';
export const load: PageServerLoad = ({ locals, url }) => ({
	approvals: approvalService().list(locals.user!.id, url.searchParams.get('state') ?? 'pending')
});
export const actions: Actions = {
	approve: async ({ request, locals }) =>
		decide(await request.formData(), locals.user!.id, 'approved'),
	reject: async ({ request, locals }) =>
		decide(await request.formData(), locals.user!.id, 'rejected')
};
function decide(form: FormData, ownerId: string, decision: 'approved' | 'rejected') {
	const id = String(form.get('approvalId') ?? '');
	if (!approvalService().decide(ownerId, id, decision))
		return fail(409, { error: 'This approval is unavailable, expired, or already decided.' });
	return { updated: true };
}
