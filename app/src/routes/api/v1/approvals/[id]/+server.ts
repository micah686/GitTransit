import { error, json, type RequestHandler } from '@sveltejs/kit';
import { approvalService } from '$lib/server/safety/approvals';
export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) error(401, { code: 'AUTH_REQUIRED', message: 'Authentication required.' });
	const body = (await request.json()) as { decision?: unknown };
	if (body.decision !== 'approved' && body.decision !== 'rejected')
		error(400, { code: 'INVALID_DECISION', message: 'Decision must be approved or rejected.' });
	if (!params.id) error(404, { code: 'NOT_FOUND', message: 'Approval not found.' });
	if (!approvalService().decide(locals.user.id, params.id, body.decision))
		error(409, {
			code: 'APPROVAL_UNAVAILABLE',
			message: 'Approval is unavailable, expired, or already decided.'
		});
	return json({ id: params.id, state: body.decision });
};
