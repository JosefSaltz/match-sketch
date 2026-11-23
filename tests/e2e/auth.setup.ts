import { test as setup } from '@playwright/test';
import { MD, MD_STATE, signIn } from './support/accounts';

setup('sign in as the test MD', async ({ page }) => {
	await page.goto('/sign-in');
	await signIn(page, MD);
	await page.context().storageState({ path: MD_STATE });
});
