import type { StepClaim } from './queue';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '../persistence/database';
import { transaction } from '../persistence/database';
import { config } from '../config';
import { ControlledGitTransport } from '../git/transport';
import { executeOneWay } from '../git/one-way';
import { CredentialEncryptionService, loadEncryptionKey } from '../crypto/credentials';
import { entityId, type ContentPolicy, type SafetyPolicy } from '../domain/types';
import type { AuthenticatedEndpoint } from '../git/types';
import { decodeCredentialEnvelope } from '../application/connection-service';
import { DiscoveryService } from '../application/discovery-service';
import { PairService } from '../application/pair-service';

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
		const result = await executeOneWay(transport, {
			routeId: entityId(row.route_id),
			runId: claim.runId,
			endpointA: endpoint(row.a_url, row.a_identity, row.a_credential_id, row.a_encrypted),
			endpointB: endpoint(row.b_url, row.b_identity, row.b_credential_id, row.b_encrypted),
			refs: content.refs,
			safety,
			lfs: content.lfs,
			capabilityGeneration: 1,
			policyGeneration: row.pair_version + row.route_generation,
			assertLeaseCurrent: () => claimIsCurrent(db, claim)
		});
		if (result.state !== 'succeeded')
			throw new Error(`Sync requires operator action: ${result.state}.`);
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
				 verification_status,created_at) VALUES (?,?,?,?, 'B',?,?,?,?, 'verified',?)`
				).run(
					randomUUID(),
					claim.ownerId,
					row.route_id,
					claim.runId,
					path.relative(config.dataDir, result.artifact.path),
					result.artifact.byteSize,
					result.artifact.digest,
					JSON.stringify({ endpoint: row.b_identity, actions: result.plan.actions }),
					observedAt
				);
		});
		return { state: result.state, actionCount: result.plan.actions.length };
	});
	return registry;
}
