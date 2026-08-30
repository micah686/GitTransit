import { error, type RequestHandler } from '@sveltejs/kit';
import { database } from '$lib/server/persistence/database';
import { EventStore } from '$lib/server/events/store';

const encoder = new TextEncoder();
const HEARTBEAT_MS = 15_000;
const QUERY_MS = 1_000;

function encodeEvent(id: number | null, type: string, data: unknown): Uint8Array {
	return encoder.encode(
		`${id === null ? '' : `id: ${id}\n`}event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
	);
}

export const GET: RequestHandler = ({ locals, request, url }) => {
	if (!locals.user) error(401, { code: 'AUTH_REQUIRED', message: 'Authentication required.' });
	const events = new EventStore(database());
	const requested = request.headers.get('last-event-id') ?? url.searchParams.get('cursor');
	let cursor =
		requested === null ? events.latestCursor(locals.user.id) : Number.parseInt(requested, 10);
	if (!Number.isSafeInteger(cursor) || cursor < 0)
		error(400, { code: 'INVALID_CURSOR', message: 'Invalid event cursor.' });
	const ownerId = locals.user.id;
	let stopped = false;
	let queryTimer: ReturnType<typeof setTimeout> | undefined;
	let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const oldest = events.oldestCursor(ownerId);
			if (cursor > 0 && oldest !== null && cursor < oldest - 1) {
				cursor = events.latestCursor(ownerId);
				controller.enqueue(encodeEvent(cursor, 'cursor-expired', { refetch: true }));
			} else controller.enqueue(encodeEvent(cursor, 'connected', { cursor }));

			const query = () => {
				if (stopped) return;
				for (const event of events.readAfter(ownerId, cursor)) {
					cursor = event.cursor;
					controller.enqueue(
						encodeEvent(event.cursor, event.type, {
							resourceIds: event.resourceIds,
							payload: event.payload,
							createdAt: event.createdAt
						})
					);
				}
				queryTimer = setTimeout(query, QUERY_MS);
			};
			query();
			heartbeatTimer = setInterval(
				() => controller.enqueue(encoder.encode(': heartbeat\n\n')),
				HEARTBEAT_MS
			);
		},
		cancel() {
			stopped = true;
			if (queryTimer) clearTimeout(queryTimer);
			if (heartbeatTimer) clearInterval(heartbeatTimer);
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
};
