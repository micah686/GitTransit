import { json, type RequestHandler } from '@sveltejs/kit';
import { checkReadiness } from '$lib/server/readiness';

export const GET: RequestHandler = async () => {
	const result = await checkReadiness();
	return json(
		{ status: result.ready ? 'ready' : 'not_ready', checks: result.checks },
		{ status: result.ready ? 200 : 503 }
	);
};
