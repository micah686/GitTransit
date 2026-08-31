import { createHmac } from 'node:crypto';
import type {
	NotificationAdapter,
	NotificationEvent,
	NotificationKind,
	NotificationTarget
} from './types';
import { NotificationDeliveryError } from './types';

function retryAt(response: Response): number | null {
	const value = response.headers.get('retry-after');
	if (!value) return null;
	if (/^\d+$/u.test(value)) return Date.now() + Number(value) * 1000;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : null;
}

async function send(
	url: URL,
	init: RequestInit,
	signal: AbortSignal,
	fetcher: typeof fetch
): Promise<void> {
	let response: Response;
	try {
		response = await fetcher(url, { ...init, signal, redirect: 'error' });
	} catch {
		if (signal.aborted) throw signal.reason;
		throw new NotificationDeliveryError(true, null, 'NETWORK');
	}
	if (!response.ok)
		throw new NotificationDeliveryError(
			response.status === 408 || response.status === 429 || response.status >= 500,
			retryAt(response),
			`HTTP_${response.status}`
		);
}

function title(event: NotificationEvent): string {
	return `GitTransit ${event.type.replaceAll('.', ' ')}`;
}

function body(event: NotificationEvent): string {
	return JSON.stringify({ event: event.type, resources: event.resourceIds, ...event.payload });
}

export class NtfyAdapter implements NotificationAdapter {
	constructor(private readonly fetcher: typeof fetch = fetch) {}
	deliver(target: NotificationTarget, event: NotificationEvent, signal: AbortSignal) {
		return send(
			target.url,
			{
				method: 'POST',
				headers: {
					'content-type': 'text/plain; charset=utf-8',
					title: title(event),
					priority: event.type === 'run.failed' ? 'high' : 'default',
					tags: 'left_right_arrow',
					...(target.config.token ? { authorization: `Bearer ${target.config.token}` } : {})
				},
				body: body(event)
			},
			signal,
			this.fetcher
		);
	}
}

export class AppriseAdapter implements NotificationAdapter {
	constructor(private readonly fetcher: typeof fetch = fetch) {}
	deliver(target: NotificationTarget, event: NotificationEvent, signal: AbortSignal) {
		return send(
			target.url,
			{
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					...(target.config.token ? { authorization: `Bearer ${target.config.token}` } : {})
				},
				body: JSON.stringify({ title: title(event), body: body(event), type: 'warning' })
			},
			signal,
			this.fetcher
		);
	}
}

export class GotifyAdapter implements NotificationAdapter {
	constructor(private readonly fetcher: typeof fetch = fetch) {}
	deliver(target: NotificationTarget, event: NotificationEvent, signal: AbortSignal) {
		if (!target.config.token) throw new NotificationDeliveryError(false, null, 'TOKEN_REQUIRED');
		const url = new URL(target.url);
		url.pathname = `${url.pathname.replace(/\/$/u, '')}/message`;
		url.searchParams.set('token', target.config.token);
		return send(
			url,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title: title(event), message: body(event), priority: 5 })
			},
			signal,
			this.fetcher
		);
	}
}

export class SignedWebhookAdapter implements NotificationAdapter {
	constructor(private readonly fetcher: typeof fetch = fetch) {}
	deliver(target: NotificationTarget, event: NotificationEvent, signal: AbortSignal) {
		if (!target.config.secret) throw new NotificationDeliveryError(false, null, 'SECRET_REQUIRED');
		const timestamp = String(Math.floor(Date.now() / 1000));
		const payload = JSON.stringify(event);
		const signature = createHmac('sha256', target.config.secret)
			.update(`${timestamp}.${payload}`)
			.digest('hex');
		return send(
			target.url,
			{
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-gittransit-event': event.type,
					'x-gittransit-delivery': event.id,
					'x-gittransit-timestamp': timestamp,
					'x-gittransit-signature': `sha256=${signature}`
				},
				body: payload
			},
			signal,
			this.fetcher
		);
	}
}

export function notificationAdapters(
	fetcher: typeof fetch = fetch
): Readonly<Record<NotificationKind, NotificationAdapter>> {
	return {
		ntfy: new NtfyAdapter(fetcher),
		apprise: new AppriseAdapter(fetcher),
		gotify: new GotifyAdapter(fetcher),
		webhook: new SignedWebhookAdapter(fetcher)
	};
}
