import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

// The public Supabase variables are inlined at build time, and SvelteKit checks them whenever
// Vite starts. Unit tests never talk to Supabase, so under Vitest placeholders stand in for any
// that aren't set (db tests and e2e get the real ones from scripts/local-env.ts).
if (process.env.VITEST) {
	process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321';
	process.env.SUPABASE_PUBLISHABLE_KEY ??= 'sb_publishable_unit_tests';
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// A Node server in a Docker image, deployed by Coolify (docker-compose.yml, docs/operations.md).
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
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.db.test.ts']
				}
			},
			{
				// Against the local Supabase stack: `pnpm db:start`, then `pnpm test:db`.
				extends: './vite.config.ts',
				test: {
					name: 'db',
					environment: 'node',
					include: ['src/**/*.db.test.ts'],
					// One database: files run one at a time so their users and rows don't race.
					fileParallelism: false
				}
			}
		]
	}
});
