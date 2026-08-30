import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { authService } from '$lib/server/auth';
import { appPath } from '$lib/server/config';

export const load: LayoutServerLoad = ({ locals }) => {
	if (authService().isSetupRequired()) redirect(303, appPath('/setup'));
	if (!locals.user) redirect(303, appPath('/login'));
	return { user: locals.user };
};
