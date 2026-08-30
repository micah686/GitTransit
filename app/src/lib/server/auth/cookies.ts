import type { Cookies } from '@sveltejs/kit';
import { config } from '$lib/server/config';

export const SESSION_COOKIE = 'gittransit_session';

const options = {
	path: config.basePath || '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: config.secureCookies,
	maxAge: 30 * 24 * 60 * 60
};

export function setSessionCookie(cookies: Cookies, token: string): void {
	cookies.set(SESSION_COOKIE, token, options);
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: options.path });
}
