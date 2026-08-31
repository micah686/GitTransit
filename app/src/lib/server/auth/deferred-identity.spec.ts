import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('deferred identity boundary', () => {
	it('does not expose active OIDC, SAML, OAuth-login, or trusted-header routes/configuration', () => {
		const routeRoot = path.resolve('src/routes');
		const routeNames = fs
			.readdirSync(routeRoot, { recursive: true, encoding: 'utf8' })
			.map(String)
			.join('\n')
			.toLowerCase();
		const configSource = fs
			.readFileSync(path.resolve('src/lib/server/config.ts'), 'utf8')
			.toLowerCase();
		for (const deferred of ['oidc', 'saml', 'oauth', 'trusted-header', 'trusted_header']) {
			expect(routeNames).not.toContain(deferred);
			expect(configSource).not.toContain(deferred);
		}
	});
});
