import type { ImmutableRefPlan, Oid, RefMap, Side } from '../domain/types';

export interface AuthenticatedEndpoint {
	readonly url: URL;
	readonly credentialId: string;
	readonly stableIdentity: string;
}

export interface Workspace {
	readonly routeId: string;
	readonly controlPath: string;
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
	prepareWorkspace(routeId: string, runId: string): Promise<Workspace>;
	fetch(workspace: Workspace, side: Side, refs: readonly string[]): Promise<RefMap>;
	isAncestor(workspace: Workspace, older: Oid, newer: Oid): Promise<boolean>;
	push(plan: ImmutableRefPlan, leases: readonly RemoteLease[]): Promise<RefMap>;
	createBundle(workspace: Workspace, side: Side): Promise<VerifiedArtifact>;
	transferLfs(workspace: Workspace, from: Side, to: Side, refs: readonly string[]): Promise<void>;
}
