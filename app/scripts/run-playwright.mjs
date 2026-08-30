import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

const environment = { ...process.env };
const testDirectory = mkdtempSync(join(tmpdir(), 'gittransit-e2e-'));
const secretDirectory = join(testDirectory, 'secrets');
mkdirSync(secretDirectory, { recursive: true });
const keyFile = join(secretDirectory, 'credential.key');
writeFileSync(keyFile, randomBytes(32), { mode: 0o600 });
environment.GITTRANSIT_DATA_DIR = testDirectory;
environment.GITTRANSIT_ENCRYPTION_KEY_FILE = keyFile;
environment.GITTRANSIT_BASE_URL = 'http://127.0.0.1:4173';
// Playwright enables colors for its child processes. Some runners inject NO_COLOR,
// and Node warns when both are present even though the application emitted no warning.
delete environment.NO_COLOR;

const child = spawn(
	process.execPath,
	[resolve('node_modules/@playwright/test/cli.js'), ...process.argv.slice(2)],
	{ env: environment, stdio: 'inherit' }
);

child.once('error', (error) => {
	console.error(error.message);
	process.exitCode = 1;
});
child.once('exit', (code, signal) => {
	rmSync(testDirectory, { recursive: true, force: true });
	if (signal) process.kill(process.pid, signal);
	else process.exitCode = code ?? 1;
});
