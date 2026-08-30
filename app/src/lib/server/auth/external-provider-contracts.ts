/** Internal extension seam only. No external provider is registered in Phase 1. */
export interface RequestContext {
	request: Request;
	requestId: string;
}

export interface LoginRedirect {
	location: URL;
	state: string;
}

export interface ExternalPrincipal {
	providerId: string;
	subject: string;
	issuer: string;
	verifiedEmail?: string;
}

export interface UserIdentityResult {
	userId: string;
	created: boolean;
}

export interface LoginProvider {
	readonly id: string;
	begin(request: RequestContext): Promise<LoginRedirect>;
	complete(request: RequestContext): Promise<ExternalPrincipal>;
}

export interface IdentityLinker {
	resolveOrCreate(principal: ExternalPrincipal): Promise<UserIdentityResult>;
}
