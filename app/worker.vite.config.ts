import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
	resolve: { alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } },
	build: {
		ssr: 'src/worker/main.ts',
		outDir: 'worker-build',
		emptyOutDir: true,
		rollupOptions: {
			onwarn(warning) {
				throw new Error(`Worker build warning treated as an error: ${warning.message}`);
			}
		}
	}
});
