import { ensureUser } from '../../scripts/users';
import { expect, test } from './fixtures';
import { createCanvas, createPlanFromCanvas } from './helpers';
import { signIn } from './support/accounts';
import { adminClient, uniqueEmail } from './support/admin';
import { pushed, synced } from './support/devices';

const plansOn = (page: import('@playwright/test').Page) =>
	page.locator('section[aria-labelledby="plans-heading"]').getByRole('listitem');

async function makePlan(page: import('@playwright/test').Page) {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay 4', width: '30', depth: '20', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay 4');
	await page.goto('/');
}

test('signing out clears the device; signing back in brings the plans back', async ({
	page,
	account
}) => {
	await makePlan(page);
	await pushed(page);
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/sign-in/);

	const other = { email: uniqueEmail('next'), password: 'test-password-1' };
	const otherId = await ensureUser({ ...other, role: 'md' });
	await signIn(page, other);
	await synced(page);
	await expect(plansOn(page)).toHaveCount(0);
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/sign-in/);

	await signIn(page, account);
	await synced(page);
	await expect(plansOn(page)).toHaveCount(1);
	await adminClient().auth.admin.deleteUser(otherId);
});

test.describe('with requests routed', () => {
	// page.route can't see requests that a service worker handles.
	test.use({ serviceWorkers: 'block' });

	test('signing out with unsynced changes warns first', async ({ page }) => {
		await page.route('**/api/sync/**', (route) => route.abort());
		await makePlan(page);
		await page.getByRole('button', { name: 'Sign out' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText(
			"2 changes on this device haven't synced. Signing out deletes them."
		);
		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Match Sketch' })).toBeVisible();
		await expect(plansOn(page)).toHaveCount(1);

		await page.getByRole('button', { name: 'Sign out' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Sign out anyway' }).click();
		await expect(page).toHaveURL(/\/sign-in/);
	});
});

test("the device's theme survives signing out", async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Theme' }).click();
	await page
		.getByRole('dialog', { name: 'Theme' })
		.getByRole('button', { name: 'Ranger Green' })
		.click();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/sign-in/);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'ranger-green');
});

test('signing out in one tab signs the other tabs out too', async ({ page, context }) => {
	await page.goto('/');
	const other = await context.newPage();
	await other.goto('/');
	await expect(other.getByRole('heading', { level: 1, name: 'Match Sketch' })).toBeVisible();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/sign-in/);
	await expect(other).toHaveURL(/\/sign-in/, { timeout: 5000 });
});
