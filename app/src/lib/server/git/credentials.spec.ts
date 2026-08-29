import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCredentialScope } from './credentials';
import { runProcess, SafeProcessError } from './process';

describe('credential-safe Git environment', () => {
	it('keeps HTTPS credentials out of arguments, environment, logs, and errors', async () => {
		const username = 'credential-user';
		const password = 'super-secret-token-value';
		const scope = await createCredentialScope({ kind: 'https', username, password });
		const serializedEnvironment = JSON.stringify(scope.env);
		expect(serializedEnvironment).not.toContain(username);
		expect(serializedEnvironment).not.toContain(password);
		const listed = spawn('/bin/sleep', ['2'], {
			env: { PATH: process.env.PATH ?? '', ...scope.env }
		});
		try {
			if (!listed.pid) throw new Error('credential process listing probe did not start');
			const commandLine = await readFile(`/proc/${String(listed.pid)}/cmdline`, 'utf8');
			expect(commandLine).not.toContain(username);
			expect(commandLine).not.toContain(password);
		} finally {
			listed.kill('SIGTERM');
		}

		// Git LFS obtains HTTPS credentials through `git credential`; prove the helper
		// can satisfy that protocol without writing its response to captured output.
		const credentialFill = await runProcess({
			command: '/bin/sh',
			args: [
				'-c',
				"printf 'protocol=https\\nhost=example.invalid\\n\\n' | git credential fill >/dev/null"
			],
			env: scope.env,
			timeoutMs: 2_000,
			redact: scope.redact
		});
		expect(credentialFill).toEqual({ stdout: '', stderr: '' });

		try {
			await runProcess({
				command: '/bin/sh',
				args: ['-c', '"$GIT_ASKPASS" Password >&2; exit 19'],
				env: scope.env,
				timeoutMs: 2_000,
				redact: scope.redact
			});
			expect.unreachable('the probe must fail');
		} catch (error) {
			expect(error).toBeInstanceOf(SafeProcessError);
			expect(String(error)).not.toContain(password);
			expect(String(error)).toContain('[REDACTED]');
		}

		const askpassPath = scope.env.GIT_ASKPASS;
		expect(askpassPath).toBeDefined();
		await scope.dispose();
		await expect(access(dirname(askpassPath ?? ''))).rejects.toThrow();
	});

	it('uses restricted files and strict host verification for SSH', async () => {
		const privateKey = '-----BEGIN PRIVATE KEY-----\nsecret-material\n-----END PRIVATE KEY-----';
		const scope = await createCredentialScope({
			kind: 'ssh',
			privateKey,
			knownHosts: 'example.test ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA'
		});
		try {
			expect(JSON.stringify(scope.env)).not.toContain(privateKey);
			const sshWrapper = scope.env.GIT_SSH;
			expect(sshWrapper).toBeDefined();
			const result = await runProcess({
				command: '/bin/sh',
				args: ['-c', 'grep StrictHostKeyChecking "$GIT_SSH"'],
				env: scope.env,
				timeoutMs: 2_000
			});
			expect(result.stdout).toContain('StrictHostKeyChecking=yes');
		} finally {
			await scope.dispose();
		}
	});
});
