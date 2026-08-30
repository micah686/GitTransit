import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { connectionService } from '$lib/server/application/connection-service';
import { discoveryService } from '$lib/server/application/discovery-service';
import { JobQueue } from '$lib/server/jobs/queue';
import { database } from '$lib/server/persistence/database';
import { randomUUID } from 'node:crypto';

export const load: PageServerLoad = ({ locals, params }) => {
	const connection = connectionService().get(locals.user!.id, params.id);
	if (!connection) error(404, { code: 'NOT_FOUND', message: 'Connection not found.' });
	return {
		connection,
		repositories: discoveryService().list(locals.user!.id, params.id)
	};
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const form = await request.formData();
		const fields = {
			name: String(form.get('name') ?? ''),
			baseUrl: String(form.get('baseUrl') ?? ''),
			apiUrl: String(form.get('apiUrl') ?? '').trim() || null,
			enabled: form.get('enabled') === 'on'
		};
		const version = Number(form.get('version'));
		try {
			if (!connectionService().update(locals.user!.id, params.id, version, fields))
				return fail(409, { error: 'This connection changed. Reload and try again.' });
			const credential = String(form.get('credential') ?? '');
			if (credential)
				connectionService().rotateCredential(
					locals.user!.id,
					params.id,
					credential,
					String(form.get('credentialKind') ?? 'token') as 'token' | 'basic' | 'app-password',
					String(form.get('username') ?? '')
				);
			return { success: 'Connection updated.' };
		} catch {
			return fail(400, {
				error: 'Unable to update connection. Check the fields and encryption-key configuration.'
			});
		}
	},
	test: async ({ locals, params }) => {
		const passed = await connectionService().testStored(locals.user!.id, params.id);
		return passed
			? { success: 'Connection test passed.' }
			: fail(422, { error: 'Connection test failed safely.' });
	},
	discover: ({ locals, params }) => {
		const connection = connectionService().get(locals.user!.id, params.id);
		if (!connection || ['fake', 'generic-git'].includes(connection.providerId))
			return fail(422, { error: 'This connection does not support named discovery.' });
		const runId = new JobQueue(database()).enqueue({
			ownerId: locals.user!.id,
			kind: 'discover',
			trigger: 'manual',
			idempotencyKey: `discover:${params.id}:${randomUUID()}`,
			steps: [{ name: 'discover-provider', checkpoint: { connectionId: params.id } }]
		});
		return { success: `Discovery queued as run ${runId}.` };
	}
};
