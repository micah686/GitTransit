// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			code: string;
			requestId?: string;
		}
		interface Locals {
			requestId: string;
			session: import('$lib/server/auth/types').AuthenticatedSession | null;
			user: import('$lib/server/auth/types').SafeUser | null;
		}
		interface PageData {
			user?: import('$lib/server/auth/types').SafeUser | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
