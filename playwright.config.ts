import { defineConfig } from '@playwright/test';
import { MD_STATE } from './tests/e2e/support/accounts';

// Run through `pnpm test:e2e`, which supplies the local Supabase stack's env (scripts/local-env.ts).
export default defineConfig({
	testDir: 'tests/e2e',
	globalSetup: './tests/e2e/global-setup.ts',
	webServer: { command: 'pnpm build && pnpm preview', port: 4173 },
	// Reduced motion keeps drag swings out of position checks; drag-swing.spec opts back in.
	use: { baseURL: 'http://localhost:4173', reducedMotion: 'reduce' },
	projects: [
		{ name: 'setup', testMatch: /auth\.setup\.ts/ },
		{
			name: 'app',
			testMatch: '**/*.spec.ts',
			dependencies: ['setup'],
			use: { storageState: MD_STATE }
		}
	]
});
