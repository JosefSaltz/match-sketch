import { expect, type Page } from '@playwright/test';

export type Account = { email: string; password: string };

/** Shared accounts for the auth and admin specs, created by global-setup.ts on the local stack. */
export const MD: Account = { email: 'md@match-sketch.test', password: 'test-password-1' };
export const ADMIN: Account = { email: 'admin@match-sketch.test', password: 'test-password-1' };

/** No stored session (the default): for specs that test signing in. */
export const SIGNED_OUT = { cookies: [], origins: [] };

/** Signs in through the sign-in page (from wherever the page is). */
export async function signIn(page: Page, account: Account): Promise<void> {
	if (!new URL(page.url()).pathname.startsWith('/sign-in')) await page.goto('/sign-in');
	await page.getByLabel('Email').fill(account.email);
	await page.getByLabel('Password').fill(account.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).not.toHaveURL(/\/sign-in/);
}
