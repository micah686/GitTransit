import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { connectionService } from '$lib/server/application/connection-service';
import type { AdapterId } from '$lib/server/providers/types';
import { appPath } from '$lib/server/config';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const values = {
			name: String(form.get('name') ?? ''),
			providerId: String(form.get('providerId') ?? '') as AdapterId,
			baseUrl: String(form.get('baseUrl') ?? ''),
			apiUrl: String(form.get('apiUrl') ?? ''),
			credential: String(form.get('credential') ?? ''),
			credentialKind: String(form.get('credentialKind') ?? 'token') as
				'token' | 'basic' | 'app-password',
			username: String(form.get('username') ?? '')
		};
		if (
			!['fake', 'generic-git', 'gitea', 'forgejo', 'gitlab', 'github', 'bitbucket-cloud'].includes(
				values.providerId
			)
		)
			return fail(400, { values, error: 'Choose a supported provider.' });
		if (!['token', 'basic', 'app-password'].includes(values.credentialKind))
			return fail(400, {
				values: { ...values, credential: '' },
				error: 'Choose a supported credential type.'
			});
		try {
			await connectionService().create(locals.user!.id, values);
		} catch {
			return fail(400, {
				values: { ...values, credential: '' },
				error:
					'Unable to create connection. Check the fields, unique name, and encryption-key configuration.'
			});
		}
		redirect(303, appPath('/connections'));
	}
};
