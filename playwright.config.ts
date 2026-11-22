import { defineConfig } from '@playwright/test';

// Run through `pnpm test:e2e`, which supplies the local Supabase stack's env (scripts/local-env.ts).
// Specs that run signed in import `test` from ./tests/e2e/fixtures (one account per test).
export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.spec.ts',
	globalSetup: './tests/e2e/global-setup.ts',
	webServer: { command: 'pnpm build && pnpm preview', port: 4173 },
	// Reduced motion keeps drag swings out of position checks; drag-swing.spec opts back in.
	use: { baseURL: 'http://localhost:4173', reducedMotion: 'reduce' },
	projects: [
		{ name: 'app', testIgnore: /offline-app\.spec\.ts/ },
		{
			// The service worker precaches the whole app before it takes control; under the rest of
			// the suite's parallel load that can take minutes, so this spec runs once they finish.
			name: 'offline',
			testMatch: /offline-app\.spec\.ts/,
			dependencies: ['app']
		}
	]
});
