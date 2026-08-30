import { error, json, type RequestHandler } from '@sveltejs/kit';
import { conflictService } from '$lib/server/application/conflict-service';
export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) error(401, { code: 'AUTH_REQUIRED', message: 'Authentication required.' });
	if (!params.id) error(404, { code: 'NOT_FOUND', message: 'Conflict not found.' });
	const body = (await request.json()) as Record<string, unknown>;
	const resolution = ['A', 'B', 'external'].includes(String(body.winner))
		? { winner: body.winner as 'A' | 'B' | 'external' }
		: body.kind === 'commit' && typeof body.oid === 'string'
			? { kind: 'commit' as const, oid: body.oid }
			: body.kind === 'keep-both' &&
				  ['A', 'B'].includes(String(body.winner)) &&
				  typeof body.newRef === 'string'
				? {
						kind: 'keep-both' as const,
						winner: body.winner as 'A' | 'B',
						newRef: body.newRef
					}
				: null;
	if (!resolution)
		error(400, { code: 'INVALID_RESOLUTION', message: 'Provide a supported resolution outcome.' });
	try {
		return json(
			{
				runId: conflictService().resolve(locals.user.id, params.id, resolution)
			},
			{ status: 202 }
		);
	} catch (cause) {
		error(409, {
			code: 'CONFLICT_UNAVAILABLE',
			message: cause instanceof Error ? cause.message : 'Conflict is unavailable.'
		});
	}
};
