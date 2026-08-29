import type {
	CapabilitySet,
	ConflictKind,
	EntityId,
	MaybeOid,
	Oid,
	ProviderId,
	RefName,
	RunState,
	Side
} from './types';

export type UtcInstant = string;
export type UserRole = 'admin' | 'member';
export type CredentialKind = 'token' | 'basic' | 'app-password' | 'ssh-key';
export type RouteStatus =
	| 'discovered'
	| 'planned'
	| 'ready'
	| 'syncing'
	| 'synced'
	| 'conflict'
	| 'blocked'
	| 'failed'
	| 'ignored'
	| 'missing'
	| 'archived';

export interface UserRecord {
	readonly id: EntityId;
	readonly normalizedEmail: string;
	readonly displayName: string;
	readonly role: UserRole;
	readonly passwordHash: string;
	readonly passwordParameters: Readonly<Record<string, number | string>>;
	readonly disabledAt: UtcInstant | null;
}

export interface SessionRecord {
	readonly id: EntityId;
	readonly userId: EntityId;
	readonly tokenHash: string;
	readonly expiresAt: UtcInstant;
	readonly revokedAt: UtcInstant | null;
}

export interface CredentialRecord {
	readonly id: EntityId;
	readonly userId: EntityId;
	readonly kind: CredentialKind;
	readonly encryptedPayload: Uint8Array;
	readonly keyVersion: number;
	readonly nonce: Uint8Array;
	readonly authenticationTag: Uint8Array;
	readonly displayHint: string;
}

export interface RemoteRepositoryRecord {
	readonly id: EntityId;
	readonly connectionId: EntityId;
	readonly namespaceId: EntityId | null;
	readonly externalId: string | null;
	readonly fullPath: string;
	readonly normalizedFullPath: string;
	readonly fetchUrlWithoutCredentials: URL;
	readonly pushUrlWithoutCredentials: URL;
	readonly discoveryState: 'observed' | 'not-observed' | 'confirmed-missing';
	readonly lastObservedAt: UtcInstant;
}

export interface RefBaselineRecord {
	readonly routeId: EntityId;
	readonly ref: RefName;
	readonly sideAOid: MaybeOid;
	readonly sideBOid: MaybeOid;
	readonly generation: number;
	readonly successfulRunId: EntityId;
}

export interface RefObservationRecord {
	readonly runId: EntityId;
	readonly routeId: EntityId;
	readonly side: Side;
	readonly ref: RefName;
	readonly oid: Oid;
	readonly peeledOid: Oid | null;
	readonly observedAt: UtcInstant;
}

export interface ConflictRecord {
	readonly id: EntityId;
	readonly ownerId: EntityId;
	readonly routeId: EntityId;
	readonly runId: EntityId;
	readonly ref: RefName;
	readonly kind: ConflictKind;
	readonly state: 'open' | 'resolved' | 'superseded';
	readonly baselineA: MaybeOid;
	readonly baselineB: MaybeOid;
	readonly currentA: MaybeOid;
	readonly currentB: MaybeOid;
}

export interface BackupArtifactRecord {
	readonly id: EntityId;
	readonly ownerId: EntityId;
	readonly routeId: EntityId;
	readonly runId: EntityId;
	readonly protectedSide: Side;
	readonly relativePath: string;
	readonly byteSize: number;
	readonly digest: string;
	readonly verified: boolean;
}

export interface RunRecord {
	readonly id: EntityId;
	readonly ownerId: EntityId;
	readonly pairId: EntityId | null;
	readonly routeId: EntityId | null;
	readonly trigger: 'manual' | 'schedule' | 'retry' | 'recovery' | 'conflict-resolution';
	readonly kind: 'discover' | 'preview' | 'provision' | 'sync' | 'cleanup' | 'metadata';
	readonly state: RunState;
	readonly idempotencyKey: string;
}

export interface RunStepRecord {
	readonly runId: EntityId;
	readonly order: number;
	readonly name: string;
	readonly attempt: number;
	readonly state: RunState;
	readonly checkpoint: Readonly<Record<string, unknown>>;
	readonly leaseOwner: string | null;
	readonly leaseExpiresAt: UtcInstant | null;
	readonly fencingToken: number;
}

export interface EventRecord {
	readonly cursor: number;
	readonly ownerId: EntityId;
	readonly type: string;
	readonly resourceIds: readonly EntityId[];
	readonly safePayload: Readonly<Record<string, unknown>>;
	readonly expiresAt: UtcInstant;
}

export interface MetadataMappingRecord {
	readonly routeId: EntityId;
	readonly component: string;
	readonly sourceIdentity: string;
	readonly targetIdentity: string;
	readonly provenance: string;
	readonly digest: string;
}

export interface RateLimitRecord {
	readonly connectionId: EntityId;
	readonly category: string;
	readonly remaining: number;
	readonly resetAt: UtcInstant | null;
}

export interface LeaseRecord {
	readonly resourceType: 'pair' | 'route' | 'run-step';
	readonly resourceId: EntityId;
	readonly workerId: string;
	readonly fencingToken: number;
	readonly expiresAt: UtcInstant;
}

export interface CapabilitySnapshot {
	readonly providerId: ProviderId;
	readonly generation: number;
	readonly capabilities: CapabilitySet;
	readonly observedAt: UtcInstant;
}
