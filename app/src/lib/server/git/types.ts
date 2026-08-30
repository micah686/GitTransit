import type { ImmutableRefPlan, Oid, RefMap, Side } from '../domain/types';
import type { GitCredential } from './credentials';

export interface AuthenticatedEndpoint {
	readonly url: URL;
	readonly credentialId: string | null;
	readonly stableIdentity: string;
	readonly credential?: GitCredential;
}

export interface Workspace {
	readonly routeId: string;
	readonly runId: string;
	readonly repositoryPath: string;
	readonly controlPath: string;
	readonly endpoints: Readonly<Record<Side, AuthenticatedEndpoint>>;
	readonly transient: boolean;
}

export interface RemoteLease {
	readonly ref: string;
	readonly expectedOid: Oid | null;
}

export interface VerifiedArtifact {
	readonly path: string;
	readonly digest: string;
	readonly byteSize: number;
}

export interface GitTransport {
	lsRemote(endpoint: AuthenticatedEndpoint): Promise<RefMap>;
	prepareWorkspace(
		routeId: string,
		runId: string,
		endpoints: Readonly<Record<Side, AuthenticatedEndpoint>>
	): Promise<Workspace>;
	fetch(workspace: Workspace, side: Side, refs: readonly string[]): Promise<RefMap>;
	isAncestor(workspace: Workspace, older: Oid, newer: Oid): Promise<boolean>;
	push(
		workspace: Workspace,
		to: Side,
		plan: ImmutableRefPlan,
		leases: readonly RemoteLease[]
	): Promise<RefMap>;
	createBundle(workspace: Workspace, side: Side): Promise<VerifiedArtifact>;
	transferLfs(workspace: Workspace, from: Side, to: Side, refs: readonly string[]): Promise<void>;
	isLfsAvailable(): Promise<boolean>;
	disposeWorkspace(workspace: Workspace): Promise<void>;
}
