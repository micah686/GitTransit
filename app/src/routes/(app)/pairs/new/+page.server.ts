import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ConnectionRepository } from '$lib/server/persistence/repositories/connections';
import { database } from '$lib/server/persistence/database';
import { pairService, type PairValues } from '$lib/server/application/pair-service';
import { appPath } from '$lib/server/config';

export const load: PageServerLoad = ({ locals }) => ({
	connections: new ConnectionRepository(database())
		.list(locals.user!.id)
		.filter((connection) => connection.enabled)
});
function input(form: FormData): PairValues {
	const defaultTarget = String(form.get('defaultTarget') ?? '').trim();
	return {
		name: String(form.get('name') ?? ''),
		connectionAId: String(form.get('connectionAId') ?? ''),
		connectionBId: String(form.get('connectionBId') ?? ''),
		direction: String(form.get('direction') ?? 'one-way') as PairValues['direction'],
		selection: {
			mode: String(form.get('selectionMode') ?? 'all') as PairValues['selection']['mode'],
			repositoryIds: form.getAll('repositoryId').map(String),
			includes: String(form.get('includes') ?? '')
				.split('\n')
				.map((value) => value.trim())
				.filter(Boolean),
			excludes: [],
			includeArchived: form.get('includeArchived') === 'on',
			forkPolicy: 'skip',
			extensions: {}
		},
		namespace: {
			strategy: String(
				form.get('namespaceStrategy') ?? 'preserve'
			) as PairValues['namespace']['strategy'],
			...(defaultTarget ? { defaultTarget } : {}),
			mappings: []
		},
		content: {
			refs: {
				includes: ['refs/heads/*', 'refs/tags/*'],
				excludes: [],
				targetOnly: String(
					form.get('targetOnly') ?? 'preserve'
				) as PairValues['content']['refs']['targetOnly']
			},
			lfs: String(form.get('lfs') ?? 'off') as PairValues['content']['lfs'],
			wiki: 'off'
		},
		safety: {
			strategy: String(
				form.get('safety') ?? 'fast-forward-only'
			) as PairValues['safety']['strategy'],
			requireBackup: form.get('safety') === 'backup-and-apply'
		},
		schedule: {
			enabled: form.get('scheduleEnabled') === 'on',
			expression: { kind: 'duration', value: String(form.get('scheduleValue') ?? '6h') },
			timezone: 'UTC',
			inventoryExpression: '24h',
			batchSize: Number(form.get('batchSize') ?? 25),
			routeConcurrency: Number(form.get('routeConcurrency') ?? 2),
			retryAttempts: 3,
			operationTimeoutMs: 120000
		},
		autoProvision: form.get('autoProvision') === 'on',
		collisionStrategy: String(
			form.get('collisionStrategy') ?? 'block'
		) as PairValues['collisionStrategy'],
		initialBaselineMode: String(
			form.get('initialBaselineMode') ?? 'require-equality'
		) as PairValues['initialBaselineMode']
	};
}
function validate(value: PairValues): void {
	if (
		!['one-way', 'two-way'].includes(value.direction) ||
		value.schedule.batchSize < 1 ||
		value.schedule.batchSize > 500 ||
		value.schedule.routeConcurrency < 1 ||
		value.schedule.routeConcurrency > 20 ||
		!['block', 'suffix'].includes(value.collisionStrategy) ||
		!['fast-forward-only', 'backup-and-apply', 'approve-destructive', 'never-delete'].includes(
			value.safety.strategy
		) ||
		!['require-equality', 'seed-a-to-b', 'seed-b-to-a', 'manual'].includes(
			value.initialBaselineMode
		)
	)
		throw new Error('Choose valid pair and scheduling options.');
}
export const actions: Actions = {
	preview: async ({ request, locals }) => {
		const values = input(await request.formData());
		try {
			validate(values);
			return { values, preview: pairService().preview(locals.user!.id, values) };
		} catch (error) {
			return fail(422, {
				values,
				error: error instanceof Error ? error.message : 'Preview failed.'
			});
		}
	},
	save: async ({ request, locals }) => {
		const values = input(await request.formData());
		let id: string;
		try {
			validate(values);
			id = pairService().create(locals.user!.id, values);
		} catch (error) {
			return fail(422, {
				values,
				error: error instanceof Error ? error.message : 'Pair could not be saved.'
			});
		}
		redirect(303, appPath(`/pairs/${id}`));
	}
};
