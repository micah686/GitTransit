export type UserRole = 'admin' | 'member';

export interface SafeUser {
	id: string;
	email: string;
	role: UserRole;
}

export interface AuthenticatedSession {
	id: string;
	user: SafeUser;
	expiresAt: Date;
}
