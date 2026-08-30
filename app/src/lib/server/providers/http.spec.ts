import { describe, expect, it } from 'vitest';
import { ProviderHttpClient } from './http';
import { ProviderOperationError, type AdapterContext } from './types';

const context: AdapterContext = {
	connectionId: 'connection-1',
	signal: new AbortController().signal,
	baseUrl: new URL('https://provider.test'),
	credential: { kind: 'token', secret: 'never-log-this' }
};

describe('provider HTTP boundary', () => {
	it('refuses to forward authorization across an origin redirect', async () => {
		const fetcher = (async () =>
			new Response(null, {
				status: 302,
				headers: { location: 'https://evil.test/steal' }
			})) as typeof fetch;
		const client = new ProviderHttpClient(context, 'Bearer', fetcher);
		await expect(client.json(new URL('https://provider.test/user'))).rejects.toMatchObject({
			kind: 'invalid'
		});
	});

	it('normalizes rate limits and never includes provider response text', async () => {
		const fetcher = (async () =>
			new Response('secret server details', {
				status: 429,
				headers: { 'retry-after': '5' }
			})) as typeof fetch;
		const client = new ProviderHttpClient(context, 'Bearer', fetcher);
		try {
			await client.json(new URL('https://provider.test/user'));
			expect.unreachable('rate limit must fail');
		} catch (error) {
			expect(error).toBeInstanceOf(ProviderOperationError);
			expect(error).toMatchObject({ kind: 'rate-limited', status: 429 });
			expect(String(error)).not.toContain('secret server details');
		}
	});

	it.each([
		[401, 'unauthorized'],
		[403, 'forbidden'],
		[404, 'not-found'],
		[429, 'rate-limited'],
		[503, 'server']
	] as const)('classifies HTTP %s as %s', async (status, kind) => {
		const fetcher = (async () =>
			new Response(JSON.stringify({ error: 'private provider detail' }), {
				status
			})) as typeof fetch;
		const client = new ProviderHttpClient(context, 'Bearer', fetcher);
		await expect(client.json(new URL('https://provider.test/resource'))).rejects.toMatchObject({
			kind,
			status
		});
	});
});
