import { expect, test } from '@playwright/test';
import { SIGNED_OUT, signIn } from './support/accounts';
import { invite, uniqueEmail } from './support/admin';
import { setPasswordLinkFor } from './support/mailpit';

test.use({ storageState: SIGNED_OUT });

const BAD_LINK = 'This link has expired or was already used.';

test('an invite leads to setting a password and signing in', async ({ page }) => {
	const email = uniqueEmail('invitee');
	await invite(email);
	await page.goto(await setPasswordLinkFor(email));
	await expect(page.getByRole('heading', { name: 'Accept your invite' })).toBeVisible();
	await page.getByRole('button', { name: 'Accept invite' }).click();
	await page.getByLabel('New password').fill('long-password-1');
	await page.getByLabel('Confirm password').fill('long-password-1');
	await page.getByRole('button', { name: 'Set password' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Match Sketch' })).toBeVisible();
	await expect(page).toHaveURL('/');

	await page.getByRole('button', { name: 'Sign out' }).click();
	await signIn(page, { email, password: 'long-password-1' });
	await expect(page).toHaveURL('/');
});

test('a used invite link says so (Review Focus #5)', async ({ page, browser }) => {
	const email = uniqueEmail('twice');
	await invite(email);
	const link = await setPasswordLinkFor(email);
	await page.goto(link);
	await page.getByRole('button', { name: 'Accept invite' }).click();
	await expect(page.getByLabel('New password')).toBeVisible();

	const again = await browser.newPage({ storageState: SIGNED_OUT });
	await again.goto(link);
	await again.getByRole('button', { name: 'Accept invite' }).click();
	await expect(again.getByText(BAD_LINK)).toBeVisible();
	await expect(again.getByRole('link', { name: 'Sign in' })).toBeVisible();
	await expect(again.getByRole('link', { name: 'Reset your password' })).toBeVisible();
	await again.close();
});

test('a made-up invite link says so', async ({ page }) => {
	await page.goto('/set-password?token_hash=nope&type=invite');
	await page.getByRole('button', { name: 'Accept invite' }).click();
	await expect(page.getByText(BAD_LINK)).toBeVisible();
});

test('a link without a token says so straight away', async ({ page }) => {
	await page.goto('/set-password');
	await expect(page.getByText(BAD_LINK)).toBeVisible();
});

test('a short password is refused before it is sent', async ({ page }) => {
	const email = uniqueEmail('short');
	await invite(email);
	await page.goto(await setPasswordLinkFor(email));
	await page.getByRole('button', { name: 'Accept invite' }).click();
	await page.getByLabel('New password').fill('short1');
	await page.getByLabel('Confirm password').fill('short1');
	await page.getByRole('button', { name: 'Set password' }).click();
	await expect(page.getByText('Use at least 8 characters.')).toBeVisible();
	await expect(page).toHaveURL(/\/set-password/);
});

test('reloading before the password is set still lets you set it', async ({ page }) => {
	const email = uniqueEmail('reload');
	await invite(email);
	await page.goto(await setPasswordLinkFor(email));
	await page.getByRole('button', { name: 'Accept invite' }).click();
	await expect(page.getByLabel('New password')).toBeVisible();
	await page.reload();
	await page.getByRole('button', { name: 'Accept invite' }).click();
	await page.getByLabel('New password').fill('long-password-1');
	await page.getByLabel('Confirm password').fill('long-password-1');
	await page.getByRole('button', { name: 'Set password' }).click();
	await expect(page).toHaveURL('/');
});
