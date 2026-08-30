import { describe, expect, it } from 'vitest';
import { joinBasePath, loadConfig } from './config';

describe('loadConfig', () => {
	it('normalizes the configured path prefix', () => {
		const loaded = loadConfig({
			GITTRANSIT_BASE_URL: 'https://example.test/gittransit/',
			GITTRANSIT_DATA_DIR: '/tmp/gittransit-config-test'
		});
		expect(loaded.basePath).toBe('/gittransit');
		expect(loaded.secureCookies).toBe(true);
	});

	it('rejects base URLs containing credentials', () => {
		expect(() =>
			loadConfig({ GITTRANSIT_BASE_URL: 'https://user:secret@example.test/' })
		).toThrow();
	});

	it('generates root and nested links under a path prefix', () => {
		expect(joinBasePath('/gittransit', '/login')).toBe('/gittransit/login');
		expect(joinBasePath('', '/login')).toBe('/login');
	});

	it('rejects non-SQLite database schemes', () => {
		expect(() => loadConfig({ GITTRANSIT_DATABASE_URL: 'postgres://db/gittransit' })).toThrow();
	});
});
