import type { StepClaim } from './queue';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '../persistence/database';
import { transaction } from '../persistence/database';
import { config } from '../config';
import { ControlledGitTransport } from '../git/transport';
import { executeOneWay } from '../git/one-way';
import { CredentialEncryptionService, loadEncryptionKey } from '../crypto/credentials';
import {
	entityId,
	type ContentPolicy,
	type ImmutableRefPlan,
	type MetadataPolicy,
	type SafetyPolicy
} from '../domain/types';
import type { AuthenticatedEndpoint } from '../git/types';
import { decodeCredentialEnvelope } from '../application/connection-service';
import { DiscoveryService } from '../application/discovery-service';
import { PairService } from '../application/pair-service';
import { ApprovalService } from '../safety/approvals';
import { planDigest } from '../safety/approvals';
import { executeTwoWay, PartialTwoWayError, type TwoWayResolution } from '../git/two-way';
import {
	refName,
	oid,
	type InitialBaselineMode,
	type RefBaseline,
	type RefName
} from '../domain/types';
import { MetadataSyncService, type MetadataSyncCheckpoint } from '../metadata/sync';
import { providerRegistry } from '../providers/registry';
import type { AdapterContext, AdapterId, ProviderCredential } from '../providers/types';

export type StepHandler = (
	claim: StepClaim,
	signal: AbortSignal
) => Promise<Readonly<Record<string, unknown>>>;

export class StepHandlerRegistry {
	readonly #handlers = new Map<string, StepHandler>();

	register(name: string, handler: StepHandler): void {
		if (this.#handlers.has(name)) throw new Error(`Duplicate step handler: ${name}`);
		this.#handlers.set(name, handler);
	}

	get(name: string): StepHandler {
		const handler = this.#handlers.get(name);
		if (!handler) throw new Error(`No handler registered for step: ${name}`);
		return handler;
	}
}

export function phaseTwoHandlers(): StepHandlerRegistry {
	const registry = new StepHandlerRegistry();
	registry.register('provider-contract-check', async (claim, signal) => {
		if (signal.aborted) throw signal.reason;
		return { verifiedAt: new Date().toISOString(), stepId: claim.stepId };
	});
	return registry;
}

interface SyncRouteRow {
	route_id: string;
	pair_version: number;
	route_generation: number;
	content_policy_json: string;
	safety_policy_json: string;
	a_url: string;
	b_url: string;
	a_identity: string | null;
	b_identity: string | null;
	a_credential_id: string | null;
	b_credential_id: string | null;
	a_encrypted: string | null;
	b_encrypted: string | null;
}

interface TwoWayRouteRow extends SyncRouteRow {
	a_push_url: string;
	b_fetch_url: string;
	selection_policy_json: string;
}

function claimIsCurrent(db: SqliteDatabase, claim: StepClaim): boolean {
	return (
		(
			db
				.prepare(
					`SELECT COUNT(*) count FROM run_steps WHERE id=? AND state='running' AND lease_owner=?
			 AND fencing_token=? AND lease_expires_at>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)`
				)
				.get(claim.stepId, claim.workerId, claim.fencingToken) as { count: number }
		).count === 1
	);
}

export function phaseThreeHandlers(db: SqliteDatabase): StepHandlerRegistry {
	const registry = phaseTwoHandlers();
	const encryption = new CredentialEncryptionService(loadEncryptionKey(config.encryptionKeyFile));
	const transport = new ControlledGitTransport({
		workspaceRoot: path.join(config.dataDir, 'work'),
		artifactRoot: path.join(config.dataDir, 'backups')
	});
	const discovery = new DiscoveryService(db, () => encryption);
	const pairs = new PairService(db);
	const approvals = new ApprovalService(db);
	registry.register('discover-provider', async (claim, signal) => {
		if (signal.aborted) throw signal.reason;
		const connectionId = claim.checkpoint.connectionId;
		if (typeof connectionId !== 'string') throw new Error('Discovery step lacks a connection ID.');
		const result = await discovery.refresh(claim.ownerId, connectionId, signal);
		return { connectionId, ...result };
	});
	registry.register('propose-routes', async (claim, signal) => {
		if (signal.aborted) throw signal.reason;
		const pairId = claim.checkpoint.pairId;
		if (typeof pairId !== 'string') throw new Error('Proposal step lacks a pair ID.');
		return { pairId, routes: pairs.refreshProposals(claim.ownerId, pairId) };
	});
	registry.register('provision-target', async (claim, signal) => {
		if (!claim.routeId) throw new Error('Provisioning requires a route.');
		return pairs.provision(claim.ownerId, claim.routeId, signal);
	});
	registry.register('reconcile-endpoint', async (claim, signal) => {
		if (!claim.routeId) throw new Error('Endpoint reconciliation requires a route.');
		const result = await pairs.reconcileEndpoint(claim.ownerId, claim.routeId, signal);
		if (result.state === 'missing') throw new Error('The target endpoint no longer exists.');
		return result;
	});
	registry.register('sync-one-way', async (claim, signal) => {
		if (signal.aborted) throw signal.reason;
		if (!claim.routeId) throw new Error('A sync step requires a route.');
		const row = db
			.prepare(
				`SELECT r.id route_id,p.version pair_version,r.generation route_generation,
			 p.content_policy_json,p.safety_policy_json,
			 a.fetch_url a_url,b.push_url b_url,a.provider_identity a_identity,b.provider_identity b_identity,
			 ca.credential_id a_credential_id,cb.credential_id b_credential_id,
			 cra.kind a_credential_kind,crb.kind b_credential_kind,
			 cra.encrypted_payload a_encrypted,crb.encrypted_payload b_encrypted
			 FROM repository_routes r JOIN mirror_pairs p ON p.id=r.pair_id AND p.user_id=r.user_id
			 JOIN route_endpoints a ON a.route_id=r.id AND a.side='A'
			 JOIN route_endpoints b ON b.route_id=r.id AND b.side='B'
			 JOIN connections ca ON ca.id=a.connection_id AND ca.user_id=r.user_id
			 JOIN connections cb ON cb.id=b.connection_id AND cb.user_id=r.user_id
			 LEFT JOIN credentials cra ON cra.id=ca.credential_id LEFT JOIN credentials crb ON crb.id=cb.credential_id
			 WHERE r.id=? AND r.user_id=? AND p.direction='one-way'`
			)
			.get(claim.routeId, claim.ownerId) as SyncRouteRow | undefined;
		if (!row) throw new Error('The one-way route is unavailable.');
		const endpoint = (
			url: string,
			identity: string | null,
			credentialId: string | null,
			encrypted: string | null
		): AuthenticatedEndpoint => {
			const endpointUrl = new URL(url);
			const decrypted =
				credentialId && encrypted
					? decodeCredentialEnvelope(
							encryption.decrypt(JSON.parse(encrypted), claim.ownerId, credentialId)
						)
					: null;
			const credential =
				credentialId && decrypted && ['http:', 'https:'].includes(endpointUrl.protocol)
					? {
							kind: 'https' as const,
							username: decrypted.username ?? 'git',
							password: decrypted.secret
						}
					: undefined;
			return {
				url: endpointUrl,
				credentialId,
				stableIdentity: identity ?? url,
				...(credential ? { credential } : {})
			};
		};
		const content = JSON.parse(row.content_policy_json) as ContentPolicy;
		const safety = JSON.parse(row.safety_policy_json) as SafetyPolicy;
		const approved = approvals.approvedFor(claim.ownerId, claim.runId, claim.stepId);
		let result: Awaited<ReturnType<typeof executeOneWay>>;
		try {
			result = await executeOneWay(transport, {
				routeId: entityId(row.route_id),
				runId: claim.runId,
				endpointA: endpoint(row.a_url, row.a_identity, row.a_credential_id, row.a_encrypted),
				endpointB: endpoint(row.b_url, row.b_identity, row.b_credential_id, row.b_encrypted),
				refs: content.refs,
				safety,
				lfs: content.lfs,
				capabilityGeneration: 1,
				policyGeneration: row.pair_version + row.route_generation,
				assertLeaseCurrent: () => claimIsCurrent(db, claim),
				...(approved ? { approvedPlan: approved.plan } : {})
			});
		} catch (error) {
			if (approved && error instanceof Error && error.message === 'APPROVED_PLAN_STALE')
				approvals.invalidate(claim.ownerId, approved.id);
			throw error;
		}
		if (result.state === 'awaiting-approval') {
			const approvalId = approvals.request(
				claim.ownerId,
				claim.runId,
				claim.stepId,
				claim.routeId,
				result.plan
			);
			return { outcome: 'awaiting-approval', approvalId };
		}
		if (result.state !== 'succeeded')
			throw new Error(`Sync requires operator action: ${result.state}.`);
		if (approved) approvals.markApplied(claim.ownerId, approved.id);
		if (!claimIsCurrent(db, claim)) throw new Error('Route lease became stale after verification.');
		transaction(db, () => {
			if (!claimIsCurrent(db, claim))
				throw new Error('Route lease became stale before checkpoint.');
			const observedAt = Date.now();
			const insertObservation = db.prepare(
				`INSERT OR REPLACE INTO ref_observations
			 (run_id,route_id,side,ref_name,object_id,observed_at) VALUES (?,?,?,?,?,?)`
			);
			for (const [name, objectId] of result.plan.expectedA)
				insertObservation.run(claim.runId, row.route_id, 'A', name, objectId, observedAt);
			for (const [name, objectId] of result.plan.expectedB)
				insertObservation.run(claim.runId, row.route_id, 'B', name, objectId, observedAt);
			if (result.artifact)
				db.prepare(
					`INSERT INTO backup_artifacts
					 (id,user_id,route_id,run_id,protected_side,relative_path,byte_size,digest,manifest_json,
					 verification_status,created_at,expires_at) VALUES (?,?,?,?, 'B',?,?,?,?, 'verified',?,?)`
				).run(
					randomUUID(),
					claim.ownerId,
					row.route_id,
					claim.runId,
					path.relative(config.dataDir, result.artifact.path),
					result.artifact.byteSize,
					result.artifact.digest,
					JSON.stringify({ endpoint: row.b_identity, actions: result.plan.actions }),
					observedAt,
					observedAt + 30 * 86_400_000
				);
		});
		return { state: result.state, actionCount: result.plan.actions.length };
	});
	registry.register('sync-two-way', async (claim, signal) => {
		if (signal.aborted) throw signal.reason;
		if (!claim.routeId) throw new Error('A two-way sync step requires a route.');
		const row = db
			.prepare(
				`SELECT r.id route_id,p.version pair_version,r.generation route_generation,p.content_policy_json,p.safety_policy_json,p.selection_policy_json,a.fetch_url a_url,a.push_url a_push_url,b.fetch_url b_fetch_url,b.push_url b_url,a.provider_identity a_identity,b.provider_identity b_identity,ca.credential_id a_credential_id,cb.credential_id b_credential_id,cra.encrypted_payload a_encrypted,crb.encrypted_payload b_encrypted FROM repository_routes r JOIN mirror_pairs p ON p.id=r.pair_id AND p.user_id=r.user_id JOIN route_endpoints a ON a.route_id=r.id AND a.side='A' JOIN route_endpoints b ON b.route_id=r.id AND b.side='B' JOIN connections ca ON ca.id=a.connection_id AND ca.user_id=r.user_id JOIN connections cb ON cb.id=b.connection_id AND cb.user_id=r.user_id LEFT JOIN credentials cra ON cra.id=ca.credential_id LEFT JOIN credentials crb ON crb.id=cb.credential_id WHERE r.id=? AND r.user_id=? AND p.direction='two-way'`
			)
			.get(claim.routeId, claim.ownerId) as TwoWayRouteRow | undefined;
		if (!row) throw new Error('The two-way route is unavailable.');
		const endpoint = (
			fetchUrl: string,
			pushUrl: string,
			identity: string | null,
			credentialId: string | null,
			encrypted: string | null
		): AuthenticatedEndpoint => {
			const url = new URL(fetchUrl);
			const decrypted =
				credentialId && encrypted
					? decodeCredentialEnvelope(
							encryption.decrypt(JSON.parse(encrypted), claim.ownerId, credentialId)
						)
					: null;
			const credential =
				credentialId && decrypted && ['http:', 'https:'].includes(url.protocol)
					? {
							kind: 'https' as const,
							username: decrypted.username ?? 'git',
							password: decrypted.secret
						}
					: undefined;
			return {
				url,
				pushUrl: new URL(pushUrl),
				credentialId,
				stableIdentity: identity ?? fetchUrl,
				...(credential ? { credential } : {})
			};
		};
		const baselineRows = db
			.prepare('SELECT ref_name,side_a_oid,side_b_oid FROM ref_baselines WHERE route_id=?')
			.all(row.route_id) as Array<{
			ref_name: string;
			side_a_oid: string | null;
			side_b_oid: string | null;
		}>;
		const baselines = new Map<RefName, RefBaseline>(
			baselineRows.map((item) => [
				refName(item.ref_name),
				{
					a: item.side_a_oid ? oid(item.side_a_oid) : null,
					b: item.side_b_oid ? oid(item.side_b_oid) : null
				}
			])
		);
		const initialized =
			(
				db
					.prepare('SELECT initialized FROM route_reconciliation_state WHERE route_id=?')
					.get(row.route_id) as { initialized: number } | undefined
			)?.initialized === 1;
		const extensions = (
			JSON.parse(row.selection_policy_json) as {
				extensions?: { initialBaselineMode?: InitialBaselineMode };
			}
		).extensions;
		const initialMode = extensions?.initialBaselineMode ?? 'require-equality';
		const approved = approvals.approvedFor(claim.ownerId, claim.runId, claim.stepId);
		const resolution = claim.checkpoint.resolution as Record<string, unknown> | undefined;
		let parsedResolution: TwoWayResolution | undefined;
		if (resolution && ['A', 'B', 'external'].includes(String(resolution.winner)))
			parsedResolution = resolution.winner as 'A' | 'B' | 'external';
		else if (
			resolution?.kind === 'commit' &&
			typeof resolution.oid === 'string' &&
			/^[0-9a-f]{40,64}$/i.test(resolution.oid)
		)
			parsedResolution = { kind: 'commit', oid: oid(resolution.oid.toLowerCase()) };
		else if (
			resolution?.kind === 'keep-both' &&
			['A', 'B'].includes(String(resolution.winner)) &&
			typeof resolution.newRef === 'string' &&
			/^refs\/heads\/[A-Za-z0-9._/-]+$/.test(resolution.newRef)
		)
			parsedResolution = {
				kind: 'keep-both',
				winner: resolution.winner as 'A' | 'B',
				newRef: refName(resolution.newRef)
			};
		const resolutions =
			resolution && typeof resolution.ref === 'string' && parsedResolution
				? new Map([[refName(resolution.ref), parsedResolution]])
				: undefined;
		let result: Awaited<ReturnType<typeof executeTwoWay>>;
		try {
			result = await executeTwoWay(transport, {
				routeId: entityId(row.route_id),
				runId: claim.runId,
				endpointA: endpoint(
					row.a_url,
					row.a_push_url,
					row.a_identity,
					row.a_credential_id,
					row.a_encrypted
				),
				endpointB: endpoint(
					row.b_fetch_url,
					row.b_url,
					row.b_identity,
					row.b_credential_id,
					row.b_encrypted
				),
				refs: (JSON.parse(row.content_policy_json) as ContentPolicy).refs,
				safety: JSON.parse(row.safety_policy_json) as SafetyPolicy,
				lfs: (JSON.parse(row.content_policy_json) as ContentPolicy).lfs,
				baselines,
				initialized,
				initialMode,
				capabilityGeneration: 1,
				policyGeneration: row.pair_version + row.route_generation,
				assertLeaseCurrent: () => claimIsCurrent(db, claim),
				onPlan: (plan, observedA, observedB) => {
					persistTwoWayObservations(db, claim, row, observedA, observedB);
					persistTwoWayPlan(db, claim, row, plan, 'planned');
				},
				...(approved ? { approvedPlan: approved.plan } : {}),
				...(resolutions ? { resolutions } : {})
			});
		} catch (error) {
			if (approved && error instanceof Error && error.message === 'APPROVED_PLAN_STALE')
				approvals.invalidate(claim.ownerId, approved.id);
			if (error instanceof PartialTwoWayError) {
				persistTwoWayObservations(db, claim, row, error.plan.expectedA, error.plan.expectedB);
				persistTwoWayArtifacts(db, claim, row, error.artifacts);
				persistTwoWayPlan(db, claim, row, error.plan, 'partial', error.appliedSides);
				return { outcome: 'partial', appliedSides: error.appliedSides };
			}
			throw error;
		}
		persistTwoWayObservations(db, claim, row, result.observedA, result.observedB);
		persistTwoWayPlan(
			db,
			claim,
			row,
			result.plan,
			result.state === 'succeeded' ? 'verified' : result.state
		);
		if (result.state === 'conflicted') {
			const ids: string[] = [];
			transaction(db, () => {
				for (const action of result.plan.actions) {
					if (action.kind !== 'conflict') continue;
					const id = randomUUID(),
						baseline = baselines.get(action.ref) ?? { a: null, b: null };
					db.prepare(
						`INSERT INTO conflicts(id,user_id,route_id,run_id,ref_name,kind,baseline_a,baseline_b,current_a,current_b,state,created_at)VALUES(?,?,?,?,?,?,?,?,?,?,'open',?) ON CONFLICT(run_id,route_id,ref_name) DO UPDATE SET kind=excluded.kind,baseline_a=excluded.baseline_a,baseline_b=excluded.baseline_b,current_a=excluded.current_a,current_b=excluded.current_b`
					).run(
						id,
						claim.ownerId,
						row.route_id,
						claim.runId,
						action.ref,
						action.reason,
						baseline.a,
						baseline.b,
						result.observedA.get(action.ref) ?? null,
						result.observedB.get(action.ref) ?? null,
						Date.now()
					);
					const persisted = db
						.prepare('SELECT id FROM conflicts WHERE run_id=? AND route_id=? AND ref_name=?')
						.get(claim.runId, row.route_id, action.ref) as { id: string };
					ids.push(persisted.id);
				}
			});
			return { outcome: 'conflicted', resourceIds: ids };
		}
		if (result.state === 'awaiting-approval') {
			const approvalId = approvals.request(
				claim.ownerId,
				claim.runId,
				claim.stepId,
				claim.routeId,
				result.plan
			);
			return { outcome: 'awaiting-approval', approvalId };
		}
		if (result.state === 'blocked') throw new Error('Two-way plan is blocked by safety policy.');
		if (result.state !== 'succeeded')
			throw new Error('Two-way run did not reach a terminal success state.');
		if (!claimIsCurrent(db, claim))
			throw new Error('Route lease became stale before baseline commit.');
		const refs = new Set<RefName>([
			...baselines.keys(),
			...result.plan.expectedA.keys(),
			...result.plan.expectedB.keys(),
			...result.plan.actions.map((action) => action.ref)
		]);
		persistTwoWayArtifacts(db, claim, row, result.artifacts);
		if (approved) approvals.markApplied(claim.ownerId, approved.id);
		return {
			outcome: 'two-way-verified',
			actionCount: result.plan.actions.length,
			generation: row.route_generation,
			baselineRefs: [...refs].map((ref) => ({
				ref,
				a: result.finalA.get(ref) ?? null,
				b: result.finalB.get(ref) ?? null
			})),
			...(typeof claim.checkpoint.conflictId === 'string'
				? {
						conflictId: claim.checkpoint.conflictId,
						resolution:
							typeof resolution?.winner === 'string'
								? resolution.winner
								: String(resolution?.kind ?? 'external')
					}
				: {})
		};
	});
	registry.register('sync-metadata', async (claim, signal) => {
		if (signal.aborted) throw signal.reason;
		if (!claim.routeId) throw new Error('A metadata step requires a route.');
		const row = db
			.prepare(
				`SELECT p.direction,p.metadata_policy_json,
			 a.canonical_full_path a_repository,b.canonical_full_path b_repository,
			 ca.id a_connection_id,ca.provider_id a_provider,ca.base_url a_base_url,ca.api_url a_api_url,
			 cb.id b_connection_id,cb.provider_id b_provider,cb.base_url b_base_url,cb.api_url b_api_url,
			 ca.credential_id a_credential_id,cb.credential_id b_credential_id,
			 cra.encrypted_payload a_encrypted,crb.encrypted_payload b_encrypted
			 FROM repository_routes r JOIN mirror_pairs p ON p.id=r.pair_id AND p.user_id=r.user_id
			 JOIN route_endpoints a ON a.route_id=r.id AND a.side='A'
			 JOIN route_endpoints b ON b.route_id=r.id AND b.side='B'
			 JOIN connections ca ON ca.id=a.connection_id AND ca.user_id=r.user_id
			 JOIN connections cb ON cb.id=b.connection_id AND cb.user_id=r.user_id
			 LEFT JOIN credentials cra ON cra.id=ca.credential_id
			 LEFT JOIN credentials crb ON crb.id=cb.credential_id
			 WHERE r.id=? AND r.user_id=?`
			)
			.get(claim.routeId, claim.ownerId) as
			| {
					direction: 'one-way' | 'two-way';
					metadata_policy_json: string;
					a_repository: string;
					b_repository: string;
					a_connection_id: string;
					b_connection_id: string;
					a_provider: AdapterId;
					b_provider: AdapterId;
					a_base_url: string;
					b_base_url: string;
					a_api_url: string | null;
					b_api_url: string | null;
					a_credential_id: string | null;
					b_credential_id: string | null;
					a_credential_kind: string | null;
					b_credential_kind: string | null;
					a_encrypted: string | null;
					b_encrypted: string | null;
			  }
			| undefined;
		if (!row) throw new Error('The metadata route is unavailable.');
		const policy = JSON.parse(row.metadata_policy_json) as MetadataPolicy;
		if (row.direction === 'two-way' && policy.authority !== 'A')
			throw new Error('Two-way Git metadata requires Side A authority.');
		const source = providerRegistry().get(row.a_provider).metadata;
		const target = providerRegistry().get(row.b_provider).metadata;
		if (!source || !target) {
			const required = Object.entries(policy.components).filter(([, mode]) => mode === 'required');
			if (required.length)
				throw new Error('Required metadata is unsupported by this provider pair.');
			return { processed: 0, written: 0, unchanged: 0, warnings: ['Metadata is unsupported.'] };
		}
		const credential = (
			credentialId: string | null,
			kind: string | null,
			encrypted: string | null
		): ProviderCredential | undefined => {
			if (
				!credentialId ||
				!kind ||
				!encrypted ||
				!['token', 'basic', 'app-password'].includes(kind)
			)
				return undefined;
			const decoded = decodeCredentialEnvelope(
				encryption.decrypt(JSON.parse(encrypted), claim.ownerId, credentialId)
			);
			return { kind: kind as ProviderCredential['kind'], ...decoded };
		};
		const context = (
			connectionId: string,
			baseUrl: string,
			apiUrl: string | null,
			value: ProviderCredential | undefined
		): AdapterContext => ({
			connectionId,
			signal,
			baseUrl: new URL(baseUrl),
			...(apiUrl ? { apiUrl: new URL(apiUrl) } : {}),
			...(value ? { credential: value } : {})
		});
		const result = await new MetadataSyncService(db).execute({
			routeId: claim.routeId,
			sourceRepository: row.a_repository,
			targetRepository: row.b_repository,
			sourceConnectionId: row.a_connection_id,
			targetConnectionId: row.b_connection_id,
			sourceContext: context(
				row.a_connection_id,
				row.a_base_url,
				row.a_api_url,
				credential(row.a_credential_id, row.a_credential_kind, row.a_encrypted)
			),
			targetContext: context(
				row.b_connection_id,
				row.b_base_url,
				row.b_api_url,
				credential(row.b_credential_id, row.b_credential_kind, row.b_encrypted)
			),
			source,
			target,
			components: { ...policy.components, wiki: 'off' },
			checkpoint: claim.checkpoint as MetadataSyncCheckpoint,
			saveCheckpoint: (checkpoint) => {
				if (!claimIsCurrent(db, claim)) throw new Error('Metadata lease became stale.');
				db.prepare(
					`UPDATE run_steps SET checkpoint_json=?,heartbeat_at=? WHERE id=? AND state='running'
				 AND lease_owner=? AND fencing_token=?`
				).run(
					JSON.stringify({ ...claim.checkpoint, ...checkpoint }),
					Date.now(),
					claim.stepId,
					claim.workerId,
					claim.fencingToken
				);
			},
			releaseTagExists: (tag) =>
				Boolean(
					db
						.prepare(
							`SELECT 1 FROM ref_observations WHERE route_id=? AND side='B' AND ref_name=?
						 ORDER BY observed_at DESC LIMIT 1`
						)
						.get(claim.routeId, `refs/tags/${tag}`)
				)
		});
		return { ...result };
	});
	registry.register('sync-wiki', async (claim, signal) => {
		if (signal.aborted) throw signal.reason;
		if (!claim.routeId) throw new Error('A wiki step requires a route.');
		const row = db
			.prepare(
				`SELECT p.metadata_policy_json,p.safety_policy_json,
			 a.fetch_url a_url,b.push_url b_url,a.provider_identity a_identity,b.provider_identity b_identity,
			 ca.credential_id a_credential_id,cb.credential_id b_credential_id,
			 cra.encrypted_payload a_encrypted,crb.encrypted_payload b_encrypted
			 FROM repository_routes r JOIN mirror_pairs p ON p.id=r.pair_id AND p.user_id=r.user_id
			 JOIN route_endpoints a ON a.route_id=r.id AND a.side='A'
			 JOIN route_endpoints b ON b.route_id=r.id AND b.side='B'
			 JOIN connections ca ON ca.id=a.connection_id JOIN connections cb ON cb.id=b.connection_id
			 LEFT JOIN credentials cra ON cra.id=ca.credential_id LEFT JOIN credentials crb ON crb.id=cb.credential_id
			 WHERE r.id=? AND r.user_id=?`
			)
			.get(claim.routeId, claim.ownerId) as
			| (Omit<
					SyncRouteRow,
					'route_id' | 'pair_version' | 'route_generation' | 'content_policy_json'
			  > & {
					metadata_policy_json: string;
			  })
			| undefined;
		if (!row) throw new Error('The wiki route is unavailable.');
		const mode = (JSON.parse(row.metadata_policy_json) as MetadataPolicy).components.wiki;
		if (mode === 'off') return { skipped: true };
		const wikiUrl = (value: string) => {
			const url = new URL(value);
			url.pathname = `${url.pathname.replace(/\.git$/u, '')}.wiki.git`;
			return url;
		};
		const endpoint = (
			value: string,
			identity: string | null,
			credentialId: string | null,
			encrypted: string | null
		): AuthenticatedEndpoint => {
			const url = wikiUrl(value);
			const decoded =
				credentialId && encrypted
					? decodeCredentialEnvelope(
							encryption.decrypt(JSON.parse(encrypted), claim.ownerId, credentialId)
						)
					: null;
			return {
				url,
				credentialId,
				stableIdentity: `${identity ?? value}:wiki`,
				...(decoded && ['http:', 'https:'].includes(url.protocol)
					? {
							credential: {
								kind: 'https' as const,
								username: decoded.username ?? 'git',
								password: decoded.secret
							}
						}
					: {})
			};
		};
		try {
			const result = await executeOneWay(transport, {
				routeId: entityId(`${claim.routeId}:wiki`),
				runId: claim.runId,
				endpointA: endpoint(row.a_url, row.a_identity, row.a_credential_id, row.a_encrypted),
				endpointB: endpoint(row.b_url, row.b_identity, row.b_credential_id, row.b_encrypted),
				refs: { includes: ['refs/heads/*'], excludes: [], targetOnly: 'preserve' },
				safety: JSON.parse(row.safety_policy_json) as SafetyPolicy,
				lfs: 'off',
				capabilityGeneration: 1,
				policyGeneration: 1,
				assertLeaseCurrent: () => claimIsCurrent(db, claim)
			});
			if (result.state !== 'succeeded')
				throw new Error(`Wiki synchronization stopped: ${result.state}.`);
			return { state: 'wiki-verified', actionCount: result.plan.actions.length };
		} catch (error) {
			if (mode === 'required') throw error;
			return { warning: error instanceof Error ? error.message : 'Wiki synchronization failed.' };
		}
	});
	return registry;
}

function persistTwoWayPlan(
	db: SqliteDatabase,
	claim: StepClaim,
	row: TwoWayRouteRow,
	plan: ImmutableRefPlan,
	outcome: 'planned' | 'awaiting-approval' | 'conflicted' | 'blocked' | 'partial' | 'verified',
	appliedSides: readonly ('A' | 'B')[] = []
): void {
	const now = Date.now();
	const stored = {
		...plan,
		expectedA: [...plan.expectedA],
		expectedB: [...plan.expectedB]
	};
	db.prepare(
		`INSERT INTO two_way_plans(run_id,route_id,plan_digest,plan_json,outcome,applied_sides_json,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(run_id,route_id)DO UPDATE SET plan_digest=excluded.plan_digest,plan_json=excluded.plan_json,outcome=excluded.outcome,applied_sides_json=excluded.applied_sides_json,updated_at=excluded.updated_at`
	).run(
		claim.runId,
		row.route_id,
		planDigest(plan),
		JSON.stringify(stored),
		outcome,
		JSON.stringify(appliedSides),
		now,
		now
	);
}

function persistTwoWayObservations(
	db: SqliteDatabase,
	claim: StepClaim,
	row: TwoWayRouteRow,
	a: ReadonlyMap<string, string>,
	b: ReadonlyMap<string, string>
): void {
	transaction(db, () => {
		const now = Date.now();
		const insert = db.prepare(
			`INSERT OR REPLACE INTO ref_observations(run_id,route_id,side,ref_name,object_id,observed_at)VALUES(?,?,?,?,?,?)`
		);
		for (const [name, value] of a) insert.run(claim.runId, row.route_id, 'A', name, value, now);
		for (const [name, value] of b) insert.run(claim.runId, row.route_id, 'B', name, value, now);
	});
}
function persistTwoWayArtifacts(
	db: SqliteDatabase,
	claim: StepClaim,
	row: TwoWayRouteRow,
	artifacts: readonly {
		side: 'A' | 'B';
		artifact: { path: string; byteSize: number; digest: string };
	}[]
): void {
	const now = Date.now();
	for (const item of artifacts)
		db.prepare(
			`INSERT INTO backup_artifacts(id,user_id,route_id,run_id,protected_side,relative_path,byte_size,digest,manifest_json,verification_status,created_at,expires_at)VALUES(?,?,?,?,?,?,?,?,?,'verified',?,?) ON CONFLICT(run_id,protected_side,relative_path) DO UPDATE SET byte_size=excluded.byte_size,digest=excluded.digest,manifest_json=excluded.manifest_json,verification_status='verified',expires_at=excluded.expires_at`
		).run(
			randomUUID(),
			claim.ownerId,
			row.route_id,
			claim.runId,
			item.side,
			path.relative(config.dataDir, item.artifact.path),
			item.artifact.byteSize,
			item.artifact.digest,
			JSON.stringify({ endpoint: item.side === 'A' ? row.a_identity : row.b_identity }),
			now,
			now + 30 * 86_400_000
		);
}
