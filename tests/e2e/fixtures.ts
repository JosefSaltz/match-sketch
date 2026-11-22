import { test as base, expect } from '@playwright/test';
import { ensureUser } from '../../scripts/users';
import { signIn, type Account } from './support/accounts';
import { adminClient, uniqueEmail } from './support/admin';

/**
 * `test` with its own MD account, signed in before the test body runs and deleted afterwards
 * (with its synced data), so tests never see each other's plans. Specs about signing in use
 * `@playwright/test` directly and start signed out.
 */
export const test = base.extend<{ account: Account }>({
	// Playwright reads the fixture's dependencies from the destructuring pattern.
	// eslint-disable-next-line no-empty-pattern
	account: async ({}, use) => {
		const account = { email: uniqueEmail('e2e'), password: 'test-password-1' };
		const id = await ensureUser({ ...account, role: 'md' });
		await use(account);
		await adminClient().auth.admin.deleteUser(id);
	},
	page: async ({ page, account }, use) => {
		await signIn(page, account);
		await use(page);
	}
});

export { expect };
