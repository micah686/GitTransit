import pino from 'pino';

export function createLogger(service: 'gittransit-web' | 'gittransit-worker') {
	return pino({
		level: process.env.GITTRANSIT_LOG_LEVEL ?? 'info',
		base: { service },
		redact: {
			paths: [
				'req.headers.authorization',
				'req.headers.cookie',
				'password',
				'token',
				'credential',
				'privateKey'
			],
			censor: '[REDACTED]'
		}
	});
}

export const logger = createLogger('gittransit-web');
