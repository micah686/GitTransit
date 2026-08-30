import { resolve } from '$app/paths';

export interface ResourceEvent {
	type: string;
	resourceIds: readonly string[];
	payload: Readonly<Record<string, unknown>>;
	createdAt: number;
}

export function connectEventStream(onEvent: (event: ResourceEvent) => void): () => void {
	let cursor = sessionStorage.getItem('gittransit-event-cursor');
	const endpoint = cursor
		? `${resolve('/api/v1/events')}?cursor=${encodeURIComponent(cursor)}`
		: resolve('/api/v1/events');
	const source = new EventSource(endpoint);
	source.addEventListener('cursor-expired', () => {
		sessionStorage.removeItem('gittransit-event-cursor');
		window.dispatchEvent(new CustomEvent('gittransit:refetch-all'));
	});
	const eventTypes = [
		'run.queued',
		'run.progress',
		'run.succeeded',
		'run.failed',
		'run.interrupted',
		'run.cancelled',
		'run.cancellation-requested'
	];
	for (const type of eventTypes) {
		source.addEventListener(type, (message) => {
			const event = message as MessageEvent<string>;
			if (event.lastEventId) {
				cursor = event.lastEventId;
				sessionStorage.setItem('gittransit-event-cursor', cursor);
			}
			const parsed = JSON.parse(event.data) as Omit<ResourceEvent, 'type'>;
			onEvent({ type, ...parsed });
			window.dispatchEvent(
				new CustomEvent('gittransit:resource-invalidated', {
					detail: { type, resourceIds: parsed.resourceIds }
				})
			);
		});
	}
	return () => source.close();
}
