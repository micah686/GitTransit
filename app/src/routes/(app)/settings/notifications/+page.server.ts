import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { notificationService } from '$lib/server/notifications/service';
import type { NotificationKind } from '$lib/server/notifications/types';

export const load: PageServerLoad = ({ locals }) => ({
	endpoints: notificationService().list(locals.user!.id)
});

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();
		try {
			const id = notificationService().create(locals.user!.id, {
				name: String(form.get('name') ?? ''),
				kind: String(form.get('kind') ?? '') as NotificationKind,
				url: String(form.get('url') ?? ''),
				token: String(form.get('token') ?? ''),
				secret: String(form.get('secret') ?? ''),
				allowInsecureHttp: form.get('allowInsecureHttp') === 'on',
				eventFilters: form.getAll('event').map(String)
			});
			return { created: id };
		} catch (error) {
			return fail(422, {
				error: error instanceof Error ? error.message : 'Endpoint could not be created.'
			});
		}
	},
	test: async ({ request, locals }) => {
		const id = String((await request.formData()).get('id') ?? '');
		try {
			await notificationService().test(locals.user!.id, id, AbortSignal.timeout(15_000));
			return { tested: id };
		} catch {
			return fail(502, {
				error: 'Test delivery failed. Verify the URL, credentials, and network policy.'
			});
		}
	},
	toggle: async ({ request, locals }) => {
		const form = await request.formData();
		if (
			!notificationService().setEnabled(
				locals.user!.id,
				String(form.get('id') ?? ''),
				form.get('enabled') === 'true'
			)
		)
			return fail(404, { error: 'Notification endpoint not found.' });
		return { updated: true };
	},
	delete: async ({ request, locals }) => {
		if (
			!notificationService().delete(
				locals.user!.id,
				String((await request.formData()).get('id') ?? '')
			)
		)
			return fail(404, { error: 'Notification endpoint not found.' });
		return { deleted: true };
	}
};
