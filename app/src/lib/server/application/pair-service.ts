import { randomUUID } from 'node:crypto';
import { Cron } from 'croner';
import type { SqliteDatabase } from '../persistence/database';
import { database, transaction } from '../persistence/database';
import { ConnectionRepository, type SafeConnection } from '../persistence/repositories/connections';
import { globMatches, resolveTargetNamespace } from '../domain/mapping';
import { validateMetadataPolicy } from '../domain/metadata-policy';
import type {
	Capability,
	ContentPolicy,
	MetadataPolicy,
	NamespacePolicy,
	SafetyPolicy,
	SchedulePolicy,
	SelectionPolicy
} from '../domain/types';
import { providerRegistry } from '../providers/registry';
import type { AdapterContext, ProviderCredential } from '../providers/types';
import { CredentialEncryptionService, loadEncryptionKey } from '../crypto/credentials';
import { config } from '../config';
import { decodeCredentialEnvelope } from './connection-service';

export interface PairValues {
	name: string;
	connectionAId: string;
	connectionBId: string;
	direction: 'one-way' | 'two-way';
	selection: SelectionPolicy;
	namespace: NamespacePolicy;
	content: ContentPolicy;
	safety: SafetyPolicy;
	schedule: SchedulePolicy;
	autoProvision: boolean;
	collisionStrategy: 'block' | 'suffix';
	initialBaselineMode: import('../domain/types').InitialBaselineMode;
	metadata?: MetadataPolicy;
}

export interface RouteProposal {
	repositoryId: string;
	sourcePath: string;
	targetPath: string;
	action: 'create' | 'reuse' | 'manual' | 'collision';
	reason: string | null;
}

export interface PairPreview {
	capabilities: readonly Capability[];
	valid: boolean;
	warnings: readonly string[];
	proposals: readonly RouteProposal[];
	selectedCount: number;
	skippedCount: number;
}

export interface PairSummary {
	id: string;
	name: string;
	direction: 'one-way' | 'two-way';
	state: string;
	sourceName: string;
	sourceProvider: string;
	sourceHost: string;
	targetName: string;
	targetProvider: string;
	targetHost: string;
	routeCount: number;
	problemCount: number;
	nextRunAt: number | null;
}

interface RepositoryRow {
	id: string;
	external_id: string | null;
	full_path: string;
	normalized_full_path: string;
	name: string;
	fetch_url: string;
	push_url: string;
	web_url: string | null;
	archived: number;
	disabled: number;
	fork: number;
}

const defaultMetadata = {
	authority: null,
	components: {
		topics: 'off',
		labels: 'off',
		milestones: 'off',
		issues: 'off',
		'change-requests': 'off',
		releases: 'off',
		wiki: 'off'
	},
	changeRequests: 'off'
} as const;

function selected(repository: RepositoryRow, policy: SelectionPolicy): boolean {
	if (repository.disabled || (!policy.includeArchived && repository.archived)) return false;
	if (policy.forkPolicy === 'skip' && repository.fork) return false;
	if (policy.mode === 'selected') return policy.repositoryIds.includes(repository.id);
	if (policy.mode === 'patterns') {
		if (policy.excludes.some((pattern) => globMatches(pattern, repository.normalized_full_path)))
			return false;
		return (
			policy.includes.length === 0 ||
			policy.includes.some((pattern) => globMatches(pattern, repository.normalized_full_path))
		);
	}
	return true;
}

function targetPath(sourcePath: string, policy: NamespacePolicy): string {
	const pieces = sourcePath.split('/');
	const name = pieces.pop();
	if (!name) throw new Error('Repository path has no name.');
	return `${resolveTargetNamespace(pieces.join('/'), policy)}/${name}`.replace(/^\/+|\/+$/gu, '');
}

export function nextSchedule(policy: SchedulePolicy, from = new Date()): number | null {
	if (!policy.enabled) return null;
	if (policy.expression.kind === 'duration') {
		const match = /^(\d+)(m|h|d)$/u.exec(policy.expression.value);
		if (!match) throw new Error('Duration must use a positive number followed by m, h, or d.');
		const amount = Number(match[1]);
		if (amount < 1) throw new Error('Schedule duration must be positive.');
		const multiplier = match[2] === 'm' ? 60_000 : match[2] === 'h' ? 3_600_000 : 86_400_000;
		return from.getTime() + amount * multiplier;
	}
	const cron = new Cron(policy.expression.value, { timezone: policy.timezone, paused: true });
	const next = cron.nextRun(from);
	if (!next) throw new Error('Schedule has no future occurrence.');
	return next.getTime();
}

export class PairService {
	private readonly connections: ConnectionRepository;
	constructor(private readonly db: SqliteDatabase) {
		this.connections = new ConnectionRepository(db);
	}

	list(ownerId: string): readonly PairSummary[] {
		return this.db
			.prepare(
				`SELECT p.id,p.name,p.direction,p.state,p.next_run_at nextRunAt,
		 a.name sourceName,a.provider_id sourceProvider,a.base_url sourceUrl,
		 b.name targetName,b.provider_id targetProvider,b.base_url targetUrl,
		 COUNT(r.id) routeCount,SUM(CASE WHEN r.status IN ('blocked','failed','missing','conflict') THEN 1 ELSE 0 END) problemCount
		 FROM mirror_pairs p JOIN connections a ON a.id=p.side_a_connection_id
		 JOIN connections b ON b.id=p.side_b_connection_id LEFT JOIN repository_routes r ON r.pair_id=p.id
		 WHERE p.user_id=? GROUP BY p.id ORDER BY p.updated_at DESC`
			)
			.all(ownerId)
			.map((raw) => {
				const row = raw as Record<string, string | number | null>;
				return {
					id: String(row.id),
					name: String(row.name),
					direction: row.direction as 'one-way' | 'two-way',
					state: String(row.state),
					sourceName: String(row.sourceName),
					sourceProvider: String(row.sourceProvider),
					sourceHost: new URL(String(row.sourceUrl)).host,
					targetName: String(row.targetName),
					targetProvider: String(row.targetProvider),
					targetHost: new URL(String(row.targetUrl)).host,
					routeCount: Number(row.routeCount),
					problemCount: Number(row.problemCount ?? 0),
					nextRunAt: row.nextRunAt === null ? null : Number(row.nextRunAt)
				};
			});
	}

	#connections(ownerId: string, values: PairValues): [SafeConnection, SafeConnection] {
		if (!values.name.trim()) throw new Error('Pair name is required.');
		if (values.connectionAId === values.connectionBId)
			throw new Error('Choose two different connection records.');
		const a = this.connections.get(ownerId, values.connectionAId);
		const b = this.connections.get(ownerId, values.connectionBId);
		if (!a?.enabled || !b?.enabled)
			throw new Error('Both connections must be enabled and owned by you.');
		return [a, b];
	}

	preview(ownerId: string, values: PairValues): PairPreview {
		const [a, b] = this.#connections(ownerId, values);
		const aCaps = new Set(a.capabilities as Capability[]);
		const bCaps = new Set(b.capabilities as Capability[]);
		const negotiated = [...aCaps].filter((capability) => bCaps.has(capability));
		const warnings: string[] = [];
		const blocking: string[] = [];
		if (!aCaps.has('git:fetch')) blocking.push('Side A cannot fetch Git content.');
		if (!bCaps.has('git:push')) blocking.push('Side B cannot push Git content.');
		if (values.direction === 'two-way' && (!aCaps.has('git:push') || !bCaps.has('git:fetch')))
			blocking.push('Two-way Git requires fetch and push on both connections.');
		if (values.content.lfs === 'on' && (!aCaps.has('lfs:fetch') || !bCaps.has('lfs:push')))
			blocking.push('Required LFS transfer is unsupported by these credentials.');
		const metadata = validateMetadataPolicy(
			values.direction,
			values.metadata ?? defaultMetadata,
			aCaps,
			bCaps
		);
		warnings.push(...metadata.warnings);
		blocking.push(...metadata.errors);
		warnings.push(...blocking);
		const rows = this.db
			.prepare(
				`SELECT id,external_id,full_path,normalized_full_path,name,fetch_url,push_url,
		 web_url,archived,disabled,fork FROM remote_repositories WHERE connection_id=? ORDER BY normalized_full_path`
			)
			.all(a.id) as RepositoryRow[];
		const chosen = rows.filter((row) => selected(row, values.selection));
		const targetRows = this.db
			.prepare('SELECT id,normalized_full_path FROM remote_repositories WHERE connection_id=?')
			.all(b.id) as Array<{ id: string; normalized_full_path: string }>;
		const targets = new Map(targetRows.map((row) => [row.normalized_full_path, row.id]));
		const paths = new Set<string>();
		const proposals = chosen.map((repository): RouteProposal => {
			let path = targetPath(repository.full_path, values.namespace);
			let normalized = path.toLowerCase();
			if (paths.has(normalized) && values.collisionStrategy === 'suffix') {
				const slash = path.lastIndexOf('/');
				const namespace = slash < 0 ? '' : path.slice(0, slash + 1);
				const name = slash < 0 ? path : path.slice(slash + 1);
				let suffix = 2;
				do {
					path = `${namespace}${name}-${suffix}`;
					normalized = path.toLowerCase();
					suffix += 1;
				} while (paths.has(normalized) || targets.has(normalized));
			}
			if (paths.has(normalized))
				return {
					repositoryId: repository.id,
					sourcePath: repository.full_path,
					targetPath: path,
					action: 'collision',
					reason: 'Multiple sources map to this target path.'
				};
			paths.add(normalized);
			if (targets.has(normalized))
				return {
					repositoryId: repository.id,
					sourcePath: repository.full_path,
					targetPath: path,
					action: 'reuse',
					reason: null
				};
			if (!bCaps.has('repository:create'))
				return {
					repositoryId: repository.id,
					sourcePath: repository.full_path,
					targetPath: path,
					action: 'manual',
					reason: 'Create this repository on the target, then retry provisioning.'
				};
			return {
				repositoryId: repository.id,
				sourcePath: repository.full_path,
				targetPath: path,
				action: 'create',
				reason: null
			};
		});
		return {
			capabilities: negotiated,
			valid: blocking.length === 0 && !proposals.some((item) => item.action === 'collision'),
			warnings,
			proposals,
			selectedCount: chosen.length,
			skippedCount: rows.length - chosen.length
		};
	}

	create(ownerId: string, values: PairValues): string {
		const preview = this.preview(ownerId, values);
		if (!preview.valid)
			throw new Error('Resolve capability warnings and mapping collisions before saving.');
		const id = randomUUID();
		const now = Date.now();
		transaction(this.db, () => {
			this.db
				.prepare(
					`INSERT INTO mirror_pairs (id,user_id,name,side_a_connection_id,side_b_connection_id,direction,state,
			 selection_policy_json,namespace_policy_json,content_policy_json,metadata_policy_json,safety_policy_json,schedule_policy_json,
			 capability_snapshot_json,validation_status,next_run_at,created_at,updated_at) VALUES (?,?,?,?,?,?,'draft',?,?,?,?,?,?,?,?,?,?,?)`
				)
				.run(
					id,
					ownerId,
					values.name.trim(),
					values.connectionAId,
					values.connectionBId,
					values.direction,
					JSON.stringify({
						...values.selection,
						extensions: {
							...values.selection.extensions,
							autoProvision: values.autoProvision,
							collisionStrategy: values.collisionStrategy,
							initialBaselineMode: values.initialBaselineMode
						}
					}),
					JSON.stringify(values.namespace),
					JSON.stringify(values.content),
					JSON.stringify(values.metadata ?? defaultMetadata),
					JSON.stringify(values.safety),
					JSON.stringify(values.schedule),
					JSON.stringify({ capabilities: preview.capabilities, observedAt: now }),
					preview.valid ? 'valid' : 'invalid',
					nextSchedule(values.schedule, new Date(now)),
					now,
					now
				);
			this.#upsertProposals(ownerId, id, values, preview, now);
		});
		return id;
	}

	refreshProposals(ownerId: string, pairId: string): number {
		const row = this.db
			.prepare('SELECT * FROM mirror_pairs WHERE id=? AND user_id=?')
			.get(pairId, ownerId) as Record<string, unknown> | undefined;
		if (!row) throw new Error('Pair not found.');
		const values: PairValues = {
			name: String(row.name),
			connectionAId: String(row.side_a_connection_id),
			connectionBId: String(row.side_b_connection_id),
			direction: row.direction as PairValues['direction'],
			selection: JSON.parse(String(row.selection_policy_json)) as SelectionPolicy,
			namespace: JSON.parse(String(row.namespace_policy_json)) as NamespacePolicy,
			content: JSON.parse(String(row.content_policy_json)) as ContentPolicy,
			safety: JSON.parse(String(row.safety_policy_json)) as SafetyPolicy,
			schedule: JSON.parse(String(row.schedule_policy_json)) as SchedulePolicy,
			autoProvision: Boolean(
				(JSON.parse(String(row.selection_policy_json)) as SelectionPolicy).extensions.autoProvision
			),
			collisionStrategy:
				(JSON.parse(String(row.selection_policy_json)) as SelectionPolicy).extensions
					.collisionStrategy === 'suffix'
					? 'suffix'
					: 'block',
			initialBaselineMode: ['require-equality', 'seed-a-to-b', 'seed-b-to-a', 'manual'].includes(
				String(
					(JSON.parse(String(row.selection_policy_json)) as SelectionPolicy).extensions
						.initialBaselineMode
				)
			)
				? ((JSON.parse(String(row.selection_policy_json)) as SelectionPolicy).extensions
						.initialBaselineMode as import('../domain/types').InitialBaselineMode)
				: 'require-equality',
			metadata: JSON.parse(String(row.metadata_policy_json)) as MetadataPolicy
		};
		const preview = this.preview(ownerId, values);
		transaction(this.db, () => this.#upsertProposals(ownerId, pairId, values, preview, Date.now()));
		return preview.proposals.length;
	}

	#upsertProposals(
		ownerId: string,
		pairId: string,
		values: PairValues,
		preview: PairPreview,
		now: number
	): void {
		for (const proposal of preview.proposals) {
			const source = this.db
				.prepare('SELECT * FROM remote_repositories WHERE id=? AND connection_id=?')
				.get(proposal.repositoryId, values.connectionAId) as RepositoryRow | undefined;
			if (!source) continue;
			const target = this.db
				.prepare(
					'SELECT * FROM remote_repositories WHERE connection_id=? AND normalized_full_path=?'
				)
				.get(values.connectionBId, proposal.targetPath.toLowerCase()) as RepositoryRow | undefined;
			const existing = this.db
				.prepare(
					'SELECT id,policy_overrides_json FROM repository_routes WHERE pair_id=? AND side_a_repository_id=?'
				)
				.get(pairId, source.id) as { id: string; policy_overrides_json: string } | undefined;
			const routeId = existing?.id ?? randomUUID();
			const parts = proposal.targetPath.split('/');
			const plannedName = parts.pop()!;
			const plannedNamespace = parts.join('/');
			const status = proposal.action === 'collision' ? 'blocked' : target ? 'ready' : 'planned';
			if (existing)
				this.db
					.prepare(
						`UPDATE repository_routes SET side_b_repository_id=?,planned_namespace=?,planned_name=?,status=CASE WHEN status IN ('ignored','archived','syncing','synced','conflict','failed') THEN status ELSE ? END,warning_summary=?,generation=generation+1,updated_at=? WHERE id=? AND user_id=?`
					)
					.run(
						target?.id ?? null,
						plannedNamespace,
						plannedName,
						status,
						proposal.reason,
						now,
						routeId,
						ownerId
					);
			else
				this.db
					.prepare(
						`INSERT INTO repository_routes (id,pair_id,user_id,side_a_repository_id,side_b_repository_id,planned_namespace,planned_name,status,warning_summary,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
					)
					.run(
						routeId,
						pairId,
						ownerId,
						source.id,
						target?.id ?? null,
						plannedNamespace,
						plannedName,
						status,
						proposal.reason,
						now,
						now
					);
			this.db
				.prepare(
					`INSERT INTO route_endpoints (route_id,side,connection_id,remote_repository_id,canonical_full_path,web_url,fetch_url,push_url,provider_identity,verified_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(route_id,side) DO UPDATE SET remote_repository_id=excluded.remote_repository_id,canonical_full_path=excluded.canonical_full_path,web_url=excluded.web_url,fetch_url=excluded.fetch_url,push_url=excluded.push_url,provider_identity=excluded.provider_identity,verified_at=excluded.verified_at`
				)
				.run(
					routeId,
					'A',
					values.connectionAId,
					source.id,
					source.full_path,
					source.web_url,
					source.fetch_url,
					source.push_url,
					source.external_id ?? source.normalized_full_path,
					now
				);
			if (target) this.#persistTargetEndpoint(routeId, values.connectionBId, target, now);
		}
	}

	async provision(
		ownerId: string,
		routeId: string,
		signal: AbortSignal
	): Promise<{ created: boolean; path: string }> {
		const row = this.db
			.prepare(
				`SELECT r.id,r.planned_namespace,r.planned_name,r.side_b_repository_id,p.side_b_connection_id connection_id,c.provider_id FROM repository_routes r JOIN mirror_pairs p ON p.id=r.pair_id AND p.user_id=r.user_id JOIN connections c ON c.id=p.side_b_connection_id AND c.user_id=r.user_id WHERE r.id=? AND r.user_id=?`
			)
			.get(routeId, ownerId) as
			| {
					id: string;
					planned_namespace: string;
					planned_name: string;
					side_b_repository_id: string | null;
					connection_id: string;
					provider_id: string;
			  }
			| undefined;
		if (!row) throw new Error('Route not found.');
		const path = `${row.planned_namespace}/${row.planned_name}`.replace(/^\/+|\/+$/gu, '');
		if (row.side_b_repository_id) return { created: false, path };
		const connection = this.connections.get(ownerId, row.connection_id);
		if (!connection) throw new Error('Target connection is unavailable.');
		const adapter = providerRegistry().get(connection.providerId);
		if (!adapter.repositories) {
			this.db
				.prepare(
					"UPDATE repository_routes SET status='blocked',safe_error_code='TARGET_PRECREATE_REQUIRED',updated_at=? WHERE id=? AND user_id=?"
				)
				.run(Date.now(), routeId, ownerId);
			throw new Error('Target repository must be created manually.');
		}
		const context = await this.#context(ownerId, connection, signal);
		let remote = await adapter.repositories.find(context, path);
		let created = false;
		if (!remote) {
			remote = await adapter.repositories.createEmpty(context, path, `route:${routeId}:provision`);
			created = true;
		}
		const normalized = adapter.normalize(remote);
		const now = Date.now();
		const repositoryId = randomUUID();
		transaction(this.db, () => {
			const existing = this.db
				.prepare(
					'SELECT id FROM remote_repositories WHERE connection_id=? AND (external_id=? OR normalized_full_path=?) LIMIT 1'
				)
				.get(connection.id, normalized.externalId, normalized.normalizedPath) as
				{ id: string } | undefined;
			const id = existing?.id ?? repositoryId;
			if (!existing)
				this.db
					.prepare(
						`INSERT INTO remote_repositories (id,connection_id,external_id,name,full_path,normalized_full_path,web_url,fetch_url,push_url,default_branch,visibility,archived,disabled,fork,hints_json,last_observed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
					)
					.run(
						id,
						connection.id,
						normalized.externalId,
						normalized.displayPath.split('/').at(-1) ?? normalized.displayPath,
						normalized.displayPath,
						normalized.normalizedPath,
						normalized.webUrl?.toString() ?? null,
						normalized.cloneUrl.toString(),
						normalized.pushUrl.toString(),
						normalized.defaultBranch,
						normalized.visibility,
						0,
						0,
						0,
						'{}',
						now,
						now,
						now
					);
			const persisted = this.db
				.prepare('SELECT * FROM remote_repositories WHERE id=?')
				.get(id) as RepositoryRow;
			this.db
				.prepare(
					"UPDATE repository_routes SET side_b_repository_id=?,status='ready',safe_error_code=NULL,warning_summary=NULL,updated_at=? WHERE id=? AND user_id=?"
				)
				.run(id, now, routeId, ownerId);
			this.#persistTargetEndpoint(routeId, connection.id, persisted, now);
		});
		return { created, path: normalized.displayPath };
	}

	async reconcileEndpoint(
		ownerId: string,
		routeId: string,
		signal: AbortSignal
	): Promise<{ state: 'available' | 'missing' | 'unchecked' }> {
		const row = this.db
			.prepare(
				`SELECT e.canonical_full_path path,c.id connection_id FROM repository_routes r
				 JOIN route_endpoints e ON e.route_id=r.id AND e.side='B'
				 JOIN connections c ON c.id=e.connection_id AND c.user_id=r.user_id
				 WHERE r.id=? AND r.user_id=?`
			)
			.get(routeId, ownerId) as { path: string; connection_id: string } | undefined;
		if (!row) return { state: 'unchecked' };
		const connection = this.connections.get(ownerId, row.connection_id);
		if (!connection) throw new Error('Target connection is unavailable.');
		const adapter = providerRegistry().get(connection.providerId);
		if (!adapter.repositories) return { state: 'unchecked' };
		const remote = await adapter.repositories.find(
			await this.#context(ownerId, connection, signal),
			row.path
		);
		if (!remote) {
			this.db
				.prepare(
					"UPDATE repository_routes SET status='missing',safe_error_code='TARGET_NOT_FOUND',warning_summary='The provider confirmed that the target endpoint is missing.',updated_at=? WHERE id=? AND user_id=?"
				)
				.run(Date.now(), routeId, ownerId);
			return { state: 'missing' };
		}
		return { state: 'available' };
	}

	async #context(
		ownerId: string,
		connection: SafeConnection,
		signal: AbortSignal
	): Promise<AdapterContext> {
		const encrypted = this.connections.readEncryptedCredential(ownerId, connection.id);
		let credential: ProviderCredential | undefined;
		if (encrypted && encrypted.kind !== 'ssh-key') {
			const service = new CredentialEncryptionService(loadEncryptionKey(config.encryptionKeyFile));
			const envelope = decodeCredentialEnvelope(
				service.decrypt(encrypted.encrypted, ownerId, encrypted.id)
			);
			credential = {
				kind: encrypted.kind,
				secret: envelope.secret,
				...(envelope.username ? { username: envelope.username } : {})
			};
		}
		return {
			connectionId: connection.id,
			signal,
			baseUrl: new URL(connection.baseUrl),
			...(connection.apiUrl ? { apiUrl: new URL(connection.apiUrl) } : {}),
			...(credential ? { credential } : {})
		};
	}

	#persistTargetEndpoint(
		routeId: string,
		connectionId: string,
		target: RepositoryRow,
		now: number
	): void {
		this.db
			.prepare(
				`INSERT INTO route_endpoints (route_id,side,connection_id,remote_repository_id,canonical_full_path,web_url,fetch_url,push_url,provider_identity,verified_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(route_id,side) DO UPDATE SET remote_repository_id=excluded.remote_repository_id,canonical_full_path=excluded.canonical_full_path,web_url=excluded.web_url,fetch_url=excluded.fetch_url,push_url=excluded.push_url,provider_identity=excluded.provider_identity,verified_at=excluded.verified_at`
			)
			.run(
				routeId,
				'B',
				connectionId,
				target.id,
				target.full_path,
				target.web_url,
				target.fetch_url,
				target.push_url,
				target.external_id ?? target.normalized_full_path,
				now
			);
	}
}

let instance: PairService | undefined;
export function pairService(): PairService {
	instance ??= new PairService(database());
	return instance;
}
