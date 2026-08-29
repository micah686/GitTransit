import { spawn } from 'node:child_process';

export interface ProcessRequest {
	readonly command: string;
	readonly args: readonly string[];
	readonly cwd?: string;
	readonly env?: Readonly<Record<string, string>>;
	readonly timeoutMs: number;
	readonly redact?: (value: string) => string;
}

export interface ProcessResult {
	readonly stdout: string;
	readonly stderr: string;
}

export class SafeProcessError extends Error {
	constructor(
		message: string,
		readonly exitCode: number | null
	) {
		super(message);
		this.name = 'SafeProcessError';
	}
}

export async function runProcess(request: ProcessRequest): Promise<ProcessResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(request.command, [...request.args], {
			...(request.cwd ? { cwd: request.cwd } : {}),
			env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...request.env },
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: false
		});
		let stdout = '';
		let stderr = '';
		const timer = setTimeout(() => child.kill('SIGKILL'), request.timeoutMs);
		child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
		child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
		child.once('error', (error) => {
			clearTimeout(timer);
			reject(new SafeProcessError(`Unable to start ${request.command}: ${error.message}`, null));
		});
		child.once('close', (code, signal) => {
			clearTimeout(timer);
			const redact = request.redact ?? ((value: string) => value);
			if (code === 0) resolve({ stdout, stderr: redact(stderr) });
			else {
				reject(
					new SafeProcessError(
						`${request.command} failed (${signal ?? `exit ${String(code)}`}): ${redact(stderr).trim()}`,
						code
					)
				);
			}
		});
	});
}
