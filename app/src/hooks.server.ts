import { randomUUID } from 'node:crypto';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { authService } from '$lib/server/auth';
import { SESSION_COOKIE } from '$lib/server/auth/cookies';
import { logger } from '$lib/server/logging';

export const handle: Handle = async ({ event, resolve }) => {
	const startedAt = performance.now();
	event.locals.requestId = event.request.headers.get('x-request-id')?.slice(0, 128) || randomUUID();
	const isProbe = ['/health', '/ready', '/api/v1/health', '/api/v1/ready'].some((path) =>
		event.url.pathname.endsWith(path)
	);
	event.locals.session = isProbe
		? null
		: authService().resolveSession(event.cookies.get(SESSION_COOKIE));
	event.locals.user = event.locals.session?.user ?? null;

	const response = await resolve(event);
	response.headers.set('x-request-id', event.locals.requestId);
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
	logger.info(
		{
			requestId: event.locals.requestId,
			method: event.request.method,
			path: event.url.pathname,
			status: response.status,
			durationMs: Math.round(performance.now() - startedAt),
			userId: event.locals.user?.id
		},
		'request completed'
	);
	return response;
};

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	logger.error({ err: error, requestId: event.locals.requestId, status }, 'request failed');
	return {
		code: status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
		message: status === 404 ? message : 'Something went wrong.',
		requestId: event.locals.requestId
	};
};
