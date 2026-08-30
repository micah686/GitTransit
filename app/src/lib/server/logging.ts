import pino from 'pino';

const level = process.env.GITTRANSIT_LOG_LEVEL ?? 'info';

export const logger = pino({
	level,
	base: { service: 'gittransit-web' },
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
