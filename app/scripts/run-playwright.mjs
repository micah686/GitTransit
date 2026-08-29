import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const environment = { ...process.env };
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
	if (signal) process.kill(process.pid, signal);
	else process.exitCode = code ?? 1;
});
