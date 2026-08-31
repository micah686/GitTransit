import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { createLogger } from './logging';

describe('structured logging redaction', () => {
	it('redacts nested credentials, tokens, signing secrets, and authorization headers', () => {
		let output = '';
		const destination = new Writable({
			write(chunk, _encoding, callback) {
				output += chunk.toString();
				callback();
			}
		});
		const logger = createLogger('gittransit-worker', destination);
		logger.info(
			{
				req: { headers: { authorization: 'Bearer auth-secret', cookie: 'session-secret' } },
				provider: { token: 'provider-secret', password: 'password-secret' },
				notification: { secret: 'webhook-secret', encrypted_config: 'ciphertext' }
			},
			'redaction probe'
		);
		expect(output).toContain('[REDACTED]');
		for (const secret of [
			'auth-secret',
			'session-secret',
			'provider-secret',
			'password-secret',
			'webhook-secret',
			'ciphertext'
		])
			expect(output).not.toContain(secret);
	});
});
