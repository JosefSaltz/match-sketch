import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.spec.ts',
	webServer: { command: 'pnpm build && pnpm preview', port: 4173 },
	// Reduced motion keeps drag swings out of position checks; drag-swing.spec opts back in.
	use: { baseURL: 'http://localhost:4173', reducedMotion: 'reduce' }
});
