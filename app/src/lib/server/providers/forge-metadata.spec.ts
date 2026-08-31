import { describe, expect, it, vi } from 'vitest';
import { ForgeMetadataAdapter } from './forge-metadata';

describe('named forge metadata adapter', () => {
	it('normalizes issue comments, observes rate limits, and writes provenance', async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([
						{
							id: 10,
							number: 4,
							title: 'A bug',
							body: 'Details',
							state: 'open',
							html_url: 'https://github.example/acme/repo/issues/4',
							user: { login: 'alice' },
							created_at: '2026-01-01T00:00:00Z',
							updated_at: '2026-01-02T00:00:00Z'
						}
					]),
					{
						headers: {
							'content-type': 'application/json',
							'x-ratelimit-limit': '5000',
							'x-ratelimit-remaining': '4999'
						}
					}
				)
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([
						{
							id: 20,
							body: 'I can reproduce this.',
							user: { login: 'bob' },
							created_at: '2026-01-03T00:00:00Z'
						}
					]),
					{ headers: { 'content-type': 'application/json' } }
				)
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						id: 40,
						number: 8,
						html_url: 'https://github.example/archive/repo/issues/8'
					}),
					{ headers: { 'content-type': 'application/json' } }
				)
			);
		const adapter = new ForgeMetadataAdapter({
			provider: 'github',
			dialect: 'github',
			components: ['issues'],
			api: () => new URL('https://api.github.example/'),
			tokenScheme: 'Bearer',
			fetcher
		});
		const context = {
			connectionId: 'connection-a',
			signal: AbortSignal.timeout(10_000),
			credential: { kind: 'token' as const, secret: 'secret' }
		};
		const page = await adapter.list(context, 'acme/repo', 'issues');
		expect(page.items).toHaveLength(1);
		expect(page.items[0]?.fields.comments).toEqual([
			expect.objectContaining({ id: 20, body: 'I can reproduce this.' })
		]);
		expect(page.rateLimit).toMatchObject({ limit: 5000, remaining: 4999 });
		const result = await adapter.upsert(
			context,
			'archive/repo',
			page.items[0]!,
			'gittransit:route:issues:4',
			null
		);
		expect(result.targetExternalId).toBe('8');
		const write = fetcher.mock.calls[2];
		expect(write?.[0].toString()).toBe('https://api.github.example/repos/archive/repo/issues');
		const body = JSON.parse(String(write?.[1]?.body)) as { body: string };
		expect(body.body).toContain('I can reproduce this.');
		expect(body.body).toContain('gittransit:route:issues:4');
	});
});
