import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const lock = readFileSync(new URL('../package-lock.json', import.meta.url));
const manifest = {
	schema: 'https://gittransit.dev/provenance/v1',
	version: JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version,
	commit: process.env.GITHUB_SHA ?? process.env.GIT_COMMIT ?? 'unknown',
	buildTime: new Date().toISOString(),
	node: process.version,
	platform: `${process.platform}/${process.arch}`,
	packageLockSha256: createHash('sha256').update(lock).digest('hex'),
	workflow: process.env.GITHUB_WORKFLOW ?? 'local'
};
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
