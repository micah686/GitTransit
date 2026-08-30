import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { authService } from '$lib/server/auth';
import { SetupClosedError } from '$lib/server/auth/service';
import { setSessionCookie } from '$lib/server/auth/cookies';
import { appPath } from '$lib/server/config';

export const load: PageServerLoad = () => {
	if (!authService().isSetupRequired()) redirect(303, appPath('/login'));
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		const confirmation = String(form.get('passwordConfirmation') ?? '');
		if (password !== confirmation) {
			return fail(400, { email, error: 'Passwords do not match.', field: 'passwordConfirmation' });
		}
		try {
			const user = await authService().createFirstAdmin(email, password);
			const { token } = authService().createSession(user);
			setSessionCookie(cookies, token);
		} catch (error) {
			if (error instanceof SetupClosedError) redirect(303, appPath('/login'));
			return fail(400, {
				email,
				error: error instanceof Error ? error.message : 'Unable to complete setup.'
			});
		}
		redirect(303, appPath('/'));
	}
};
