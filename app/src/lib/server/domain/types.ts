export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type Oid = Brand<string, 'Oid'>;
export type RefName = Brand<string, 'RefName'>;
export type EntityId = Brand<string, 'EntityId'>;

export type Side = 'A' | 'B';
export type Direction = 'one-way' | 'two-way';
export type ProviderId =
	| 'github'
	| 'gitlab'
	| 'bitbucket-cloud'
	| 'bitbucket-data-center'
	| 'gitea'
	| 'forgejo'
	| 'generic-git';

export type Capability =
	| 'identity:read'
	| 'namespace:list'
	| 'repository:list'
	| 'repository:read'
	| 'repository:create'
	| 'repository:update'
	| 'git:fetch'
	| 'git:push'
	| 'git:delete-ref'
	| 'lfs:fetch'
	| 'lfs:push'
	| 'topics:read'
	| 'topics:write'
	| 'labels:read'
	| 'labels:write'
	| 'milestones:read'
	| 'milestones:write'
	| 'issues:read'
	| 'issues:write'
	| 'change-requests:read'
	| 'change-requests:write'
	| 'releases:read'
	| 'releases:write'
	| 'wiki:fetch'
	| 'wiki:push';

export type CapabilitySet = ReadonlySet<Capability>;
export type RefMap = ReadonlyMap<RefName, Oid>;
export type MaybeOid = Oid | null;

export type ConflictKind =
	| 'diverged'
	| 'delete-modify'
	| 'tag-rewrite'
	| 'protected-ref'
	| 'destination-mismatch'
	| 'mapping-collision'
	| 'metadata';

export type RefAction =
	| { readonly kind: 'create'; readonly ref: RefName; readonly newOid: Oid; readonly to: Side }
	| {
			readonly kind: 'fast-forward';
			readonly ref: RefName;
			readonly oldOid: Oid;
			readonly newOid: Oid;
			readonly to: Side;
	  }
	| {
			readonly kind: 'force-update';
			readonly ref: RefName;
			readonly oldOid: Oid;
			readonly newOid: Oid;
			readonly to: Side;
	  }
	| { readonly kind: 'delete'; readonly ref: RefName; readonly oldOid: Oid; readonly from: Side }
	| { readonly kind: 'noop'; readonly ref: RefName; readonly oid?: Oid }
	| { readonly kind: 'conflict'; readonly ref: RefName; readonly reason: ConflictKind };

export interface RefBaseline {
	readonly a: MaybeOid;
	readonly b: MaybeOid;
}

export interface ImmutableRefPlan {
	readonly routeId: EntityId;
	readonly observedEndpointA: string;
	readonly observedEndpointB: string;
	readonly capabilityGeneration: number;
	readonly policyGeneration: number;
	readonly expectedA: RefMap;
	readonly expectedB: RefMap;
	readonly actions: readonly RefAction[];
}

export type SafetyStrategy =
	'fast-forward-only' | 'backup-and-apply' | 'approve-destructive' | 'never-delete';
export type TargetOnlyRefPolicy = 'preserve' | 'delete-with-approval' | 'error';
export type LfsPolicy = 'off' | 'auto' | 'on';
export type MetadataMode = 'off' | 'on' | 'required';
export type ChangeRequestPolicy = 'off' | 'archive-as-issue' | 'native-when-compatible';
export type ForkPolicy = 'skip' | 'independent-copy' | 'native-fork';
export type NamespaceStrategy = 'preserve' | 'single-namespace' | 'flat-user' | 'map';
export type InitialBaselineMode = 'require-equality' | 'seed-a-to-b' | 'seed-b-to-a' | 'manual';

export interface ManagedRefPolicy {
	readonly includes: readonly string[];
	readonly excludes: readonly string[];
	readonly targetOnly: TargetOnlyRefPolicy;
}

export interface SafetyPolicy {
	readonly strategy: SafetyStrategy;
	readonly requireBackup: boolean;
}

export interface SelectionPolicy {
	readonly mode: 'all' | 'selected' | 'patterns';
	readonly repositoryIds: readonly string[];
	readonly includes: readonly string[];
	readonly excludes: readonly string[];
	readonly includeArchived: boolean;
	readonly forkPolicy: ForkPolicy;
	readonly extensions: Readonly<Record<string, unknown>>;
}

export interface NamespaceMappingRule {
	readonly source: string;
	readonly target: string;
	readonly match: 'exact' | 'glob';
	readonly overrides?: Readonly<Partial<ContentPolicy>>;
}

export interface NamespacePolicy {
	readonly strategy: NamespaceStrategy;
	readonly defaultTarget?: string;
	readonly mappings: readonly NamespaceMappingRule[];
}

export interface ContentPolicy {
	readonly refs: ManagedRefPolicy;
	readonly lfs: LfsPolicy;
	readonly wiki: MetadataMode;
}

export type MetadataComponent =
	'topics' | 'labels' | 'milestones' | 'issues' | 'change-requests' | 'releases' | 'wiki';

export interface MetadataPolicy {
	readonly authority: 'A' | null;
	readonly components: Readonly<Record<MetadataComponent, MetadataMode>>;
	readonly changeRequests: ChangeRequestPolicy;
}

export interface SchedulePolicy {
	readonly enabled: boolean;
	readonly expression: { readonly kind: 'duration' | 'cron'; readonly value: string };
	readonly timezone: string;
	readonly inventoryExpression: string;
	readonly batchSize: number;
	readonly routeConcurrency: number;
	readonly retryAttempts: number;
	readonly operationTimeoutMs: number;
}

export type RunState =
	| 'queued'
	| 'running'
	| 'awaiting-approval'
	| 'conflicted'
	| 'succeeded'
	| 'partial'
	| 'failed'
	| 'cancelled'
	| 'interrupted';

export interface ConnectionContract {
	readonly id: EntityId;
	readonly ownerId: EntityId;
	readonly providerId: ProviderId;
	readonly normalizedName: string;
	readonly baseUrl: URL;
	readonly credentialId: EntityId;
	readonly capabilities: CapabilitySet;
	readonly capabilityGeneration: number;
}

export interface MirrorPairContract {
	readonly id: EntityId;
	readonly ownerId: EntityId;
	readonly connectionAId: EntityId;
	readonly connectionBId: EntityId;
	readonly direction: Direction;
	readonly selection: SelectionPolicy;
	readonly namespace: NamespacePolicy;
	readonly content: ContentPolicy;
	readonly metadata: MetadataPolicy;
	readonly safety: SafetyPolicy;
	readonly schedule: SchedulePolicy;
	readonly version: number;
}

export interface RouteEndpointContract {
	readonly side: Side;
	readonly connectionId: EntityId;
	readonly repositoryId: EntityId | null;
	readonly canonicalPath: string;
	readonly fetchUrl: URL;
	readonly pushUrl: URL;
	readonly stableIdentity: string;
}

export interface RepositoryRouteContract {
	readonly id: EntityId;
	readonly pairId: EntityId;
	readonly ownerId: EntityId;
	readonly endpointA: RouteEndpointContract;
	readonly endpointB: RouteEndpointContract;
	readonly generation: number;
}

export const oid = (value: string): Oid => value as Oid;
export const refName = (value: string): RefName => value as RefName;
export const entityId = (value: string): EntityId => value as EntityId;
