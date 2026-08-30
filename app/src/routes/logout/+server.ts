import { redirect, type RequestHandler } from '@sveltejs/kit';
import { authService } from '$lib/server/auth';
import { clearSessionCookie, SESSION_COOKIE } from '$lib/server/auth/cookies';
import { appPath } from '$lib/server/config';

export const POST: RequestHandler = ({ cookies }) => {
	authService().revokeSession(cookies.get(SESSION_COOKIE));
	clearSessionCookie(cookies);
	redirect(303, appPath('/login'));
};
