import { expect, test, type Page } from '@playwright/test';
import { SIGNED_OUT, signIn } from './support/accounts';
import { adminClient, invite, uniqueEmail } from './support/admin';
import { messagesTo, setPasswordLinkFor } from './support/mailpit';

test.use({ storageState: SIGNED_OUT });

const SENT = /If .+ has an account, a reset link is on its way\./;

async function requestReset(page: Page, email: string) {
	await page.goto('/sign-in');
	await page.getByRole('link', { name: 'Forgot your password?' }).click();
	await expect(page).toHaveURL('/forgot-password');
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Send reset link' }).click();
	await expect(page.getByText(SENT)).toBeVisible();
}

async function chooseNewPassword(page: Page, email: string, password: string) {
	await page.goto(await setPasswordLinkFor(email));
	await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
	await page.getByRole('button', { name: 'Continue' }).click();
	await page.getByLabel('New password').fill(password);
	await page.getByLabel('Confirm password').fill(password);
	await page.getByRole('button', { name: 'Set password' }).click();
	await expect(page).toHaveURL('/');
}

test('a forgotten password can be reset from the sign-in page', async ({ page }) => {
	const email = uniqueEmail('forgetful');
	const { error } = await adminClient().auth.admin.createUser({
		email,
		password: 'old-password-1',
		email_confirm: true
	});
	expect(error).toBeNull();
	await requestReset(page, email);
	await chooseNewPassword(page, email, 'new-password-1');
	await page.getByRole('button', { name: 'Sign out' }).click();
	await signIn(page, { email, password: 'new-password-1' });
	await expect(page).toHaveURL('/');
});

test('an invitee whose invite expired can reset instead', async ({ page }) => {
	const email = uniqueEmail('late');
	await invite(email);
	await requestReset(page, email);
	await chooseNewPassword(page, email, 'long-password-1');
});

test('an unknown email gets the same answer and no email', async ({ page }) => {
	const email = uniqueEmail('nobody');
	await requestReset(page, email);
	await page.waitForTimeout(1500);
	expect(await messagesTo(email)).toHaveLength(0);
});
