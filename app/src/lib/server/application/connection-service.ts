import { randomUUID } from 'node:crypto';
import type { AdapterId, ConnectionProbe } from '$lib/server/providers/types';
import { providerRegistry } from '$lib/server/providers/registry';
import {
	ConnectionRepository,
	type SafeConnection
} from '$lib/server/persistence/repositories/connections';
import { database } from '$lib/server/persistence/database';
import { config } from '$lib/server/config';
import { CredentialEncryptionService, loadEncryptionKey } from '$lib/server/crypto/credentials';
import type { ProviderCredential } from '$lib/server/providers/types';

export interface ConnectionInput {
	name: string;
	providerId: AdapterId;
	baseUrl: string;
	apiUrl?: string;
	credential?: string;
	credentialKind?: 'token' | 'basic' | 'app-password';
	username?: string;
}

function validateInput(input: ConnectionInput): { baseUrl: URL; apiUrl?: URL } {
	if (!input.name.trim() || input.name.trim().length > 100)
		throw new Error('Connection name is required.');
	const url = new URL(input.baseUrl);
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
		throw new Error('Base URL must be HTTP(S) and must not contain credentials.');
	}
	if (input.credential && input.credential.length < 8)
		throw new Error('Credentials must contain at least 8 characters.');
	if (!['fake', 'generic-git'].includes(input.providerId) && !input.credential)
		throw new Error('A credential is required for named provider discovery.');
	if (
		(input.credentialKind === 'basic' || input.credentialKind === 'app-password') &&
		!input.username?.trim()
	)
		throw new Error('A username is required for basic or app-password authentication.');
	let apiUrl: URL | undefined;
	if (input.apiUrl?.trim()) {
		apiUrl = new URL(input.apiUrl);
		if (!['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.username || apiUrl.password)
			throw new Error('API URL must be HTTP(S) and must not contain credentials.');
	}
	return { baseUrl: url, ...(apiUrl ? { apiUrl } : {}) };
}

export interface CredentialEnvelope {
	readonly secret: string;
	readonly username?: string;
}

function providerCredential(input: ConnectionInput): ProviderCredential | undefined {
	if (!input.credential) return undefined;
	const kind = input.credentialKind ?? 'token';
	return {
		kind,
		secret: input.credential,
		...(input.username?.trim() ? { username: input.username.trim() } : {})
	};
}

export function decodeCredentialEnvelope(value: string): CredentialEnvelope {
	try {
		const parsed = JSON.parse(value) as Partial<CredentialEnvelope>;
		if (typeof parsed.secret === 'string')
			return {
				secret: parsed.secret,
				...(typeof parsed.username === 'string' ? { username: parsed.username } : {})
			};
	} catch {
		// Credentials created before Phase 4 contain the secret directly.
	}
	return { secret: value };
}

export class ConnectionService {
	constructor(
		private readonly repository: ConnectionRepository,
		private readonly encryption: CredentialEncryptionService | (() => CredentialEncryptionService)
	) {}

	private encryptionService(): CredentialEncryptionService {
		return typeof this.encryption === 'function' ? this.encryption() : this.encryption;
	}

	list(actorId: string): readonly SafeConnection[] {
		return this.repository.list(actorId);
	}
	get(actorId: string, id: string): SafeConnection | null {
		return this.repository.get(actorId, id);
	}

	async test(
		input: ConnectionInput
	): Promise<{ probe: ConnectionProbe; capabilities: readonly string[] }> {
		const urls = validateInput(input);
		const adapter = providerRegistry().get(input.providerId);
		const controller = new AbortController();
		const timer = setTimeout(
			() => controller.abort(new Error('Connection test timed out.')),
			10_000
		);
		try {
			const context = {
				connectionId: 'unsaved',
				signal: controller.signal,
				baseUrl: urls.baseUrl,
				...(urls.apiUrl ? { apiUrl: urls.apiUrl } : {}),
				...(providerCredential(input) ? { credential: providerCredential(input)! } : {})
			};
			const [probe, capabilities] = await Promise.all([
				adapter.testConnection(context),
				adapter.discoverCapabilities(context)
			]);
			return { probe, capabilities: [...capabilities].sort() };
		} finally {
			clearTimeout(timer);
		}
	}

	async create(actorId: string, input: ConnectionInput): Promise<SafeConnection> {
		const urls = validateInput(input);
		const tested = await this.test(input);
		let credential: Parameters<ConnectionRepository['create']>[0]['credential'];
		if (input.credential) {
			const credentialId = randomUUID();
			const encryptedValue = input.username?.trim()
				? JSON.stringify({ secret: input.credential, username: input.username.trim() })
				: input.credential;
			credential = {
				id: credentialId,
				kind: input.credentialKind ?? 'token',
				encrypted: this.encryptionService().encrypt(encryptedValue, actorId, credentialId),
				hint: `••••${input.credential.slice(-4)}`
			};
		}
		return this.repository.create({
			ownerId: actorId,
			name: input.name,
			providerId: input.providerId,
			baseUrl: urls.baseUrl.toString(),
			...(urls.apiUrl ? { apiUrl: urls.apiUrl.toString() } : {}),
			...(credential ? { credential } : {}),
			probe: { product: tested.probe.product, version: tested.probe.version },
			capabilities: tested.capabilities
		});
	}

	update(
		actorId: string,
		id: string,
		version: number,
		fields: { name: string; baseUrl: string; apiUrl?: string | null; enabled: boolean }
	): boolean {
		const { apiUrl, ...baseFields } = fields;
		validateInput({
			...baseFields,
			providerId: 'fake',
			...(apiUrl ? { apiUrl } : {})
		});
		return this.repository.update(actorId, id, version, fields);
	}

	rotateCredential(
		actorId: string,
		id: string,
		plaintext: string,
		kind: 'token' | 'basic' | 'app-password' = 'token',
		username?: string
	): boolean {
		if (plaintext.length < 8) throw new Error('Credentials must contain at least 8 characters.');
		if ((kind === 'basic' || kind === 'app-password') && !username?.trim())
			throw new Error('A username is required for this credential type.');
		const credentialId = randomUUID();
		const value = username?.trim()
			? JSON.stringify({ secret: plaintext, username: username.trim() })
			: plaintext;
		return this.repository.replaceCredential(actorId, id, {
			id: credentialId,
			kind,
			encrypted: this.encryptionService().encrypt(value, actorId, credentialId),
			hint: `••••${plaintext.slice(-4)}`
		});
	}

	async testStored(actorId: string, id: string): Promise<boolean> {
		const connection = this.get(actorId, id);
		if (!connection) return false;
		try {
			const encrypted = this.repository.readEncryptedCredential(actorId, id);
			const envelope = encrypted
				? decodeCredentialEnvelope(
						this.encryptionService().decrypt(encrypted.encrypted, actorId, encrypted.id)
					)
				: null;
			await this.test({
				name: connection.name,
				providerId: connection.providerId,
				baseUrl: connection.baseUrl,
				...(connection.apiUrl ? { apiUrl: connection.apiUrl } : {}),
				...(envelope
					? {
							credential: envelope.secret,
							credentialKind:
								encrypted?.kind === 'basic' || encrypted?.kind === 'app-password'
									? encrypted.kind
									: 'token',
							...(envelope.username ? { username: envelope.username } : {})
						}
					: {})
			});
			return this.repository.recordTest(actorId, id, 'ok', null);
		} catch {
			this.repository.recordTest(actorId, id, 'failed', 'CONNECTION_TEST_FAILED');
			return false;
		}
	}
}

let instance: ConnectionService | undefined;
export function connectionService(): ConnectionService {
	instance ??= new ConnectionService(
		new ConnectionRepository(database()),
		() => new CredentialEncryptionService(loadEncryptionKey(config.encryptionKeyFile))
	);
	return instance;
}
