import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface HttpsCredential {
	readonly kind: 'https';
	readonly username: string;
	readonly password: string;
}

export interface SshCredential {
	readonly kind: 'ssh';
	readonly privateKey: string;
	readonly knownHosts: string;
	readonly passphrase?: string;
}

export type GitCredential = HttpsCredential | SshCredential;

export interface CredentialScope {
	readonly env: Readonly<Record<string, string>>;
	readonly redact: (value: string) => string;
	dispose(): Promise<void>;
}

const executableMode = 0o700;
const secretMode = 0o600;

async function restrictedFile(path: string, contents: string, mode = secretMode): Promise<void> {
	await writeFile(path, contents, { encoding: 'utf8', mode, flag: 'wx' });
	await chmod(path, mode);
}

function redactor(secrets: readonly string[]): (value: string) => string {
	return (value) => {
		let result = value.replace(/https?:\/\/[^/@\s]+@/giu, (match) =>
			match.replace(/\/\/.*@/u, '//[REDACTED]@')
		);
		result = result.replace(/(authorization\s*:\s*)[^\r\n]+/giu, '$1[REDACTED]');
		for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) {
			result = result.replaceAll(secret, '[REDACTED]');
		}
		return result;
	};
}

export async function createCredentialScope(credential: GitCredential): Promise<CredentialScope> {
	const directory = await mkdtemp(join(tmpdir(), 'gittransit-auth-'));
	const env: Record<string, string> = {
		GIT_TERMINAL_PROMPT: '0',
		GCM_INTERACTIVE: 'never'
	};
	const secrets: string[] = [];
	try {
		if (credential.kind === 'https') {
			const usernamePath = join(directory, 'username');
			const passwordPath = join(directory, 'password');
			const askpassPath = join(directory, 'askpass.sh');
			const helperPath = join(directory, 'credential-helper.sh');
			await restrictedFile(usernamePath, credential.username);
			await restrictedFile(passwordPath, credential.password);
			await restrictedFile(
				askpassPath,
				`#!/bin/sh\ncase "$1" in\n  *sername*) exec /bin/cat '${usernamePath}' ;;\n  *) exec /bin/cat '${passwordPath}' ;;\nesac\n`,
				executableMode
			);
			await restrictedFile(
				helperPath,
				`#!/bin/sh\nif [ "$1" = get ]; then\n  printf 'username='; /bin/cat '${usernamePath}'; printf '\\npassword='; /bin/cat '${passwordPath}'; printf '\\n'\nfi\n`,
				executableMode
			);
			env.GIT_ASKPASS = askpassPath;
			// Empty helper resets inherited/system helpers before installing the scoped one.
			env.GIT_CONFIG_COUNT = '2';
			env.GIT_CONFIG_KEY_0 = 'credential.helper';
			env.GIT_CONFIG_VALUE_0 = '';
			env.GIT_CONFIG_KEY_1 = 'credential.helper';
			env.GIT_CONFIG_VALUE_1 = `!${helperPath}`;
			secrets.push(credential.username, credential.password);
		} else {
			const keyPath = join(directory, 'id');
			const knownHostsPath = join(directory, 'known_hosts');
			const sshPath = join(directory, 'ssh.sh');
			await restrictedFile(keyPath, credential.privateKey);
			await restrictedFile(knownHostsPath, credential.knownHosts);
			await restrictedFile(
				sshPath,
				`#!/bin/sh\nexec ssh -i '${keyPath}' -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile='${knownHostsPath}' "$@"\n`,
				executableMode
			);
			env.GIT_SSH = sshPath;
			secrets.push(credential.privateKey, credential.passphrase ?? '');
			if (credential.passphrase) {
				const passphrasePath = join(directory, 'passphrase');
				const askpassPath = join(directory, 'ssh-askpass.sh');
				await restrictedFile(passphrasePath, credential.passphrase);
				await restrictedFile(
					askpassPath,
					`#!/bin/sh\nexec /bin/cat '${passphrasePath}'\n`,
					executableMode
				);
				env.SSH_ASKPASS = askpassPath;
				env.SSH_ASKPASS_REQUIRE = 'force';
			}
		}
		return {
			env,
			redact: redactor(secrets),
			async dispose() {
				await rm(directory, { recursive: true, force: true });
			}
		};
	} catch (error) {
		await rm(directory, { recursive: true, force: true });
		throw error;
	}
}
