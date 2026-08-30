import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

const configuredUrl = new URL(process.env.GITTRANSIT_BASE_URL ?? 'http://localhost:5173');
const basePath = configuredUrl.pathname === '/' ? '' : configuredUrl.pathname.replace(/\/$/, '');
if (basePath && !basePath.startsWith('/'))
	throw new Error('GITTRANSIT_BASE_URL has an invalid path');

export default defineConfig({
	logLevel: 'warn',
	build: {
		rollupOptions: {
			onwarn(warning) {
				throw new Error(`Build warning treated as an error: ${warning.message}`);
			}
		}
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			paths: { base: basePath as '' | `/${string}` },
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
