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

export interface ConnectionInput {
	name: string;
	providerId: AdapterId;
	baseUrl: string;
	credential?: string;
}

function validateInput(input: ConnectionInput): URL {
	if (!input.name.trim() || input.name.trim().length > 100)
		throw new Error('Connection name is required.');
	const url = new URL(input.baseUrl);
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
		throw new Error('Base URL must be HTTP(S) and must not contain credentials.');
	}
	if (input.credential && input.credential.length < 8)
		throw new Error('Credentials must contain at least 8 characters.');
	return url;
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
		validateInput(input);
		const adapter = providerRegistry().get(input.providerId);
		const controller = new AbortController();
		const timer = setTimeout(
			() => controller.abort(new Error('Connection test timed out.')),
			10_000
		);
		try {
			const context = { connectionId: 'unsaved', signal: controller.signal };
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
		const url = validateInput(input);
		const tested = await this.test(input);
		let credential: Parameters<ConnectionRepository['create']>[0]['credential'];
		if (input.credential) {
			const credentialId = randomUUID();
			credential = {
				id: credentialId,
				kind: 'token',
				encrypted: this.encryptionService().encrypt(input.credential, actorId, credentialId),
				hint: `••••${input.credential.slice(-4)}`
			};
		}
		return this.repository.create({
			ownerId: actorId,
			name: input.name,
			providerId: input.providerId,
			baseUrl: url.toString(),
			...(credential ? { credential } : {}),
			probe: { product: tested.probe.product, version: tested.probe.version },
			capabilities: tested.capabilities
		});
	}

	update(
		actorId: string,
		id: string,
		version: number,
		fields: { name: string; baseUrl: string; enabled: boolean }
	): boolean {
		validateInput({ ...fields, providerId: 'fake' });
		return this.repository.update(actorId, id, version, fields);
	}

	rotateCredential(actorId: string, id: string, plaintext: string): boolean {
		if (plaintext.length < 8) throw new Error('Credentials must contain at least 8 characters.');
		const credentialId = randomUUID();
		return this.repository.replaceCredential(actorId, id, {
			id: credentialId,
			kind: 'token',
			encrypted: this.encryptionService().encrypt(plaintext, actorId, credentialId),
			hint: `••••${plaintext.slice(-4)}`
		});
	}

	async testStored(actorId: string, id: string): Promise<boolean> {
		const connection = this.get(actorId, id);
		if (!connection) return false;
		try {
			await this.test({
				name: connection.name,
				providerId: connection.providerId,
				baseUrl: connection.baseUrl
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
