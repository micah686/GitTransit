import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs';

export interface EncryptedSecret {
	version: 1;
	iv: string;
	tag: string;
	ciphertext: string;
}

export function loadEncryptionKey(filename: string): Buffer {
	const stat = fs.statSync(filename);
	if (!stat.isFile()) throw new Error('Credential encryption key path is not a file.');
	if ((stat.mode & 0o077) !== 0)
		throw new Error('Credential encryption key must not be accessible by group or others.');
	const value = fs.readFileSync(filename);
	const key = value.length === 32 ? value : Buffer.from(value.toString('utf8').trim(), 'base64');
	if (key.length !== 32)
		throw new Error('Credential encryption key must contain exactly 32 random bytes.');
	return key;
}

export class CredentialEncryptionService {
	constructor(private readonly key: Buffer) {
		if (key.length !== 32) throw new Error('AES-256-GCM requires a 32-byte key.');
	}

	encrypt(plaintext: string, ownerId: string, credentialId: string): EncryptedSecret {
		const iv = randomBytes(12);
		const cipher = createCipheriv('aes-256-gcm', this.key, iv);
		cipher.setAAD(Buffer.from(`${ownerId}:${credentialId}`));
		const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
		return {
			version: 1,
			iv: iv.toString('base64'),
			tag: cipher.getAuthTag().toString('base64'),
			ciphertext: ciphertext.toString('base64')
		};
	}

	decrypt(secret: EncryptedSecret, ownerId: string, credentialId: string): string {
		if (secret.version !== 1) throw new Error('Unsupported credential key version.');
		const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(secret.iv, 'base64'));
		decipher.setAAD(Buffer.from(`${ownerId}:${credentialId}`));
		decipher.setAuthTag(Buffer.from(secret.tag, 'base64'));
		return Buffer.concat([
			decipher.update(Buffer.from(secret.ciphertext, 'base64')),
			decipher.final()
		]).toString('utf8');
	}
}
