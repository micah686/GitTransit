import { error, json, type RequestHandler } from '@sveltejs/kit';
import { maintenanceService } from '$lib/server/operations/maintenance';
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, { code: 'AUTH_REQUIRED', message: 'Authentication required.' });
	const body = (await request.json().catch(() => ({}))) as { dryRun?: unknown };
	if (typeof body.dryRun !== 'boolean')
		error(400, { code: 'INVALID_REQUEST', message: 'dryRun must be a boolean.' });
	return json(await maintenanceService().cleanup(locals.user.id, { dryRun: body.dryRun }));
};
