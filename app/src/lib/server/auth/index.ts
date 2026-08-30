import { AuthService } from './service';
import { database } from '$lib/server/persistence/database';

let instance: AuthService | undefined;
export function authService(): AuthService {
	instance ??= new AuthService(database());
	return instance;
}
