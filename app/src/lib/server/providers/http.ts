import {
	ProviderOperationError,
	type AdapterContext,
	type ProviderCredential,
	type ProviderErrorKind
} from './types';

export interface ProviderResponse<T> {
	readonly value: T;
	readonly headers: Headers;
	readonly url: URL;
}

function errorKind(status: number): ProviderErrorKind {
	if (status === 401) return 'unauthorized';
	if (status === 403) return 'forbidden';
	if (status === 404) return 'not-found';
	if (status === 429) return 'rate-limited';
	if (status >= 500) return 'server';
	return 'invalid';
}

function retryAt(headers: Headers): number | null {
	const retryAfter = headers.get('retry-after');
	if (retryAfter && /^\d+$/u.test(retryAfter)) return Date.now() + Number(retryAfter) * 1000;
	const reset = headers.get('x-ratelimit-reset') ?? headers.get('ratelimit-reset');
	if (reset && /^\d+$/u.test(reset)) return Number(reset) * 1000;
	return null;
}

function authHeader(credential: ProviderCredential | undefined, scheme: string): string | null {
	if (!credential) return null;
	if (credential.kind === 'basic' || credential.kind === 'app-password') {
		if (!credential.username) throw new ProviderOperationError('invalid', null);
		return `Basic ${Buffer.from(`${credential.username}:${credential.secret}`).toString('base64')}`;
	}
	return `${scheme} ${credential.secret}`;
}

export class ProviderHttpClient {
	constructor(
		private readonly context: AdapterContext,
		private readonly tokenScheme: string,
		private readonly fetcher: typeof fetch = fetch
	) {}

	async json<T>(
		url: URL,
		options: {
			method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
			body?: Readonly<Record<string, unknown>>;
			headers?: Readonly<Record<string, string>>;
			allowNotFound?: boolean;
		} = {}
	): Promise<ProviderResponse<T> | null> {
		let current = url;
		for (let redirects = 0; redirects <= 3; redirects += 1) {
			let response: Response;
			try {
				const authorization = authHeader(this.context.credential, this.tokenScheme);
				response = await this.fetcher(current, {
					method: options.method ?? 'GET',
					signal: this.context.signal,
					redirect: 'manual',
					headers: {
						accept: 'application/json',
						...(authorization ? { authorization } : {}),
						...(options.body ? { 'content-type': 'application/json' } : {}),
						...options.headers
					},
					...(options.body ? { body: JSON.stringify(options.body) } : {})
				});
			} catch {
				if (this.context.signal.aborted) throw this.context.signal.reason;
				throw new ProviderOperationError('network', null);
			}
			if ([301, 302, 303, 307, 308].includes(response.status)) {
				const location = response.headers.get('location');
				if (!location || redirects === 3)
					throw new ProviderOperationError('invalid', response.status);
				const next = new URL(location, current);
				if (next.origin !== current.origin)
					throw new ProviderOperationError('invalid', response.status);
				current = next;
				continue;
			}
			if (response.status === 404 && options.allowNotFound) return null;
			if (!response.ok)
				throw new ProviderOperationError(
					errorKind(response.status),
					response.status,
					retryAt(response.headers)
				);
			try {
				return { value: (await response.json()) as T, headers: response.headers, url: current };
			} catch {
				throw new ProviderOperationError('invalid', response.status);
			}
		}
		throw new ProviderOperationError('invalid', null);
	}
}

export function requiredBase(context: AdapterContext): URL {
	if (!context.baseUrl) throw new ProviderOperationError('invalid', null);
	return context.baseUrl;
}

export function apiBase(context: AdapterContext, suffix: string): URL {
	if (context.apiUrl) return new URL(context.apiUrl.toString().replace(/\/?$/u, '/'));
	const base = requiredBase(context);
	return new URL(`${base.pathname.replace(/\/$/u, '')}${suffix}/`, base.origin);
}

export function pageCursor(value: string | undefined): number {
	if (!value) return 1;
	if (!/^\d+$/u.test(value) || Number(value) < 1) throw new ProviderOperationError('invalid', null);
	return Number(value);
}

export function nextPageFromLink(headers: Headers): string | null {
	const link = headers.get('link');
	if (!link) return null;
	for (const entry of link.split(',')) {
		const match = entry.match(/<([^>]+)>;\s*rel="?next"?/u);
		if (match?.[1]) return new URL(match[1]).searchParams.get('page');
	}
	return null;
}
