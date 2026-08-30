import { dev } from '$app/environment';
import path from 'node:path';

export interface AppConfig {
	baseUrl: URL;
	basePath: string;
	databasePath: string;
	dataDir: string;
	encryptionKeyFile: string;
	secureCookies: boolean;
}

function parseBaseUrl(value: string): URL {
	const url = new URL(value);
	if (
		!['http:', 'https:'].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw new Error('GITTRANSIT_BASE_URL must be an HTTP(S) origin with an optional path');
	}
	url.pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, '');
	return url;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
	const baseUrl = parseBaseUrl(env.GITTRANSIT_BASE_URL ?? 'http://localhost:5173');
	const dataDir = path.resolve(env.GITTRANSIT_DATA_DIR ?? (dev ? '.gittransit' : '/data'));
	const databaseValue =
		env.GITTRANSIT_DATABASE_URL ?? path.join(dataDir, 'db', 'gittransit.sqlite');
	if (/^[a-z][a-z0-9+.-]*:/i.test(databaseValue) && !databaseValue.startsWith('file:')) {
		throw new Error('GITTRANSIT_DATABASE_URL must be a SQLite path or file: URL');
	}
	const databasePath = databaseValue.startsWith('file:') ? databaseValue.slice(5) : databaseValue;

	return {
		baseUrl,
		basePath: baseUrl.pathname === '/' ? '' : baseUrl.pathname,
		databasePath: path.resolve(databasePath),
		dataDir,
		encryptionKeyFile: path.resolve(
			env.GITTRANSIT_ENCRYPTION_KEY_FILE ?? path.join(dataDir, 'secrets', 'credential.key')
		),
		secureCookies: baseUrl.protocol === 'https:'
	};
}

export const config = loadConfig();

export function joinBasePath(basePath: string, pathname: string): string {
	const suffix = pathname.startsWith('/') ? pathname : `/${pathname}`;
	return `${basePath}${suffix}` || '/';
}

export function appPath(pathname: string): string {
	return joinBasePath(config.basePath, pathname);
}
