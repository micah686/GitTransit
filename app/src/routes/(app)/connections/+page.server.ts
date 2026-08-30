import type { PageServerLoad } from './$types';
import { connectionService } from '$lib/server/application/connection-service';

export const load: PageServerLoad = ({ locals }) => ({
	connections: connectionService().list(locals.user!.id)
});
