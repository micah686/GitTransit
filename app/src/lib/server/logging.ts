import pino from 'pino';

export function createLogger(
	service: 'gittransit-web' | 'gittransit-worker',
	destination?: pino.DestinationStream
) {
	const options: pino.LoggerOptions = {
		level: process.env.GITTRANSIT_LOG_LEVEL ?? 'info',
		base: { service },
		redact: {
			paths: [
				'req.headers.authorization',
				'req.headers.cookie',
				'password',
				'*.password',
				'token',
				'*.token',
				'credential',
				'*.credential',
				'secret',
				'*.secret',
				'privateKey',
				'*.privateKey',
				'encrypted_config',
				'*.encrypted_config'
			],
			censor: '[REDACTED]'
		}
	};
	return destination ? pino(options, destination) : pino(options);
}

export const logger = createLogger('gittransit-web');
