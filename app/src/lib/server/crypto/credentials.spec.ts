import { describe, expect, it } from 'vitest';
import { CredentialEncryptionService } from './credentials';

describe('CredentialEncryptionService', () => {
	it('encrypts with owner and credential identity as authenticated context', () => {
		const service = new CredentialEncryptionService(Buffer.alloc(32, 7));
		const encrypted = service.encrypt('super-secret', 'owner-1', 'credential-1');
		expect(JSON.stringify(encrypted)).not.toContain('super-secret');
		expect(service.decrypt(encrypted, 'owner-1', 'credential-1')).toBe('super-secret');
		expect(() => service.decrypt(encrypted, 'owner-2', 'credential-1')).toThrow();
	});
});
