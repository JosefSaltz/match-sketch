import { expect, test, type Page } from '@playwright/test';
import { test as mdTest } from './fixtures';
import { ADMIN, MD, SIGNED_OUT, signIn } from './support/accounts';
import { uniqueEmail } from './support/admin';
import { messagesTo } from './support/mailpit';

/** Posts the invite action as the page's enhanced form would (same origin, so CSRF passes). */
async function postInvite(page: Page, email: string) {
	return page.request.post('/admin?/invite', {
		form: { email, displayName: '' },
		headers: {
			origin: new URL(page.url()).origin,
			accept: 'application/json',
			'x-sveltekit-action': 'true'
		}
	});
}

test.describe('as the admin', () => {
	test.use({ storageState: SIGNED_OUT });

	test.beforeEach(async ({ page }) => {
		await signIn(page, ADMIN);
	});

	test('home links to the admin page, which invites an MD', async ({ page }) => {
		await page.getByRole('link', { name: 'Admin' }).click();
		await expect(page).toHaveURL('/admin');
		const email = uniqueEmail('new');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Name (optional)').fill('New MD');
		await page.getByRole('button', { name: 'Send invite' }).click();
		await expect(page.getByText(`Invite sent to ${email}.`)).toBeVisible();
		const row = page.getByRole('row').filter({ hasText: email });
		await expect(row).toContainText('New MD');
		await expect(row).toContainText('Invited');
		await expect.poll(async () => (await messagesTo(email)).length).toBe(1);
	});

	test('inviting an existing account says so', async ({ page }) => {
		await page.goto('/admin');
		await page.getByLabel('Email').fill(MD.email);
		await page.getByRole('button', { name: 'Send invite' }).click();
		await expect(page.getByText('That email already has an account.')).toBeVisible();
	});

	test('lists the test accounts with their roles', async ({ page }) => {
		await page.goto('/admin');
		await expect(page.getByRole('row').filter({ hasText: ADMIN.email })).toContainText('admin');
		await expect(page.getByRole('row').filter({ hasText: MD.email })).toContainText('Active');
	});

	test("shows today's model spend against the ceiling", async ({ page }) => {
		await page.goto('/admin');
		await expect(page.getByText(/^Model spend today: \$\d+\.\d{2} of \$10\.00$/)).toBeVisible();
	});

	test('the invite action itself works for an admin', async ({ page }) => {
		await page.goto('/admin');
		const email = uniqueEmail('direct');
		const response = await postInvite(page, email);
		expect(response.status()).toBe(200);
		await expect.poll(async () => (await messagesTo(email)).length).toBe(1);
	});
});

mdTest.describe('as an MD', () => {
	mdTest('home has no admin link and the admin page says admins only', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1, name: 'Match Sketch' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
		await page.goto('/admin');
		await expect(page.getByText('Admins only')).toBeVisible();
	});

	mdTest('posting the invite action directly is refused (Review Focus #3)', async ({ page }) => {
		await page.goto('/');
		const email = uniqueEmail('sneaky');
		const response = await postInvite(page, email);
		expect(response.status()).toBe(403);
		await page.waitForTimeout(2000);
		expect(await messagesTo(email)).toHaveLength(0);
	});
});

test.describe('signed out', () => {
	test.use({ storageState: SIGNED_OUT });

	test('the admin page sends you to sign in', async ({ page }) => {
		await page.goto('/admin');
		await expect(page).toHaveURL('/sign-in?next=%2Fadmin');
	});
});
