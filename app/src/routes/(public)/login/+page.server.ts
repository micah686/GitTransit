import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { authService } from '$lib/server/auth';
import { InvalidCredentialsError, LoginThrottledError } from '$lib/server/auth/service';
import { setSessionCookie } from '$lib/server/auth/cookies';
import { appPath } from '$lib/server/config';

export const load: PageServerLoad = ({ locals }) => {
	if (authService().isSetupRequired()) redirect(303, appPath('/setup'));
	if (locals.user) redirect(303, appPath('/'));
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		try {
			const result = await authService().login(email, password, getClientAddress());
			setSessionCookie(cookies, result.token);
		} catch (error) {
			if (error instanceof LoginThrottledError) {
				return fail(429, { email, error: 'Too many sign-in attempts. Try again later.' });
			}
			if (error instanceof InvalidCredentialsError) {
				return fail(400, { email, error: 'Email or password is incorrect.' });
			}
			throw error;
		}
		redirect(303, appPath('/'));
	}
};
