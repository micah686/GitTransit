import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { connectionService } from '$lib/server/application/connection-service';

export const load: PageServerLoad = ({ locals, params }) => {
	const connection = connectionService().get(locals.user!.id, params.id);
	if (!connection) error(404, { code: 'NOT_FOUND', message: 'Connection not found.' });
	return { connection };
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const form = await request.formData();
		const fields = {
			name: String(form.get('name') ?? ''),
			baseUrl: String(form.get('baseUrl') ?? ''),
			enabled: form.get('enabled') === 'on'
		};
		const version = Number(form.get('version'));
		try {
			if (!connectionService().update(locals.user!.id, params.id, version, fields))
				return fail(409, { error: 'This connection changed. Reload and try again.' });
			const credential = String(form.get('credential') ?? '');
			if (credential) connectionService().rotateCredential(locals.user!.id, params.id, credential);
			return { success: 'Connection updated.' };
		} catch {
			return fail(400, {
				error: 'Unable to update connection. Check the fields and encryption-key configuration.'
			});
		}
	},
	test: async ({ locals, params }) => {
		const passed = await connectionService().testStored(locals.user!.id, params.id);
		return passed
			? { success: 'Connection test passed.' }
			: fail(422, { error: 'Connection test failed safely.' });
	}
};
