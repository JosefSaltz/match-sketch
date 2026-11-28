import { expect, test } from './fixtures';
import { createCanvas, createPlanFromCanvas } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
});

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the stage gets the width and the page does not scroll sideways', async ({ page }) => {
		const stage = page.getByRole('application', { name: 'Stage canvas' });
		expect((await stage.boundingBox())!.width).toBeGreaterThanOrEqual(300);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
	});

	test('the Symbols drawer opens and closes', async ({ page }) => {
		const drawer = page.getByRole('complementary', { name: 'Symbols' });
		await expect(drawer).toBeHidden();
		await page.getByRole('button', { name: 'Symbols', exact: true }).click();
		await expect(drawer).toBeVisible();
		await page.getByRole('button', { name: 'Close symbols' }).click();
		await expect(drawer).toBeHidden();
	});

	test('the Inspector drawer opens and closes, and Escape closes it', async ({ page }) => {
		const drawer = page.getByRole('complementary', { name: 'Inspector' });
		await page.getByRole('button', { name: 'Inspector', exact: true }).click();
		await expect(drawer).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(drawer).toBeHidden();
		await page.getByRole('button', { name: 'Inspector', exact: true }).click();
		await page.getByRole('button', { name: 'Close inspector' }).click();
		await expect(drawer).toBeHidden();
	});

	test('arming a symbol closes the Symbols drawer', async ({ page }) => {
		await page.getByRole('button', { name: 'Symbols', exact: true }).click();
		await page.getByTestId('palette-item-wall').click();
		await expect(page.getByRole('complementary', { name: 'Symbols' })).toBeHidden();
		await expect(page.getByTestId('palette-item-wall')).toHaveAttribute('aria-pressed', 'true');
	});

	test('the Menu drawer holds the secondary controls', async ({ page }) => {
		await expect(page.getByLabel('Snap')).toBeHidden();
		await page.getByRole('button', { name: 'Menu' }).click();
		await expect(page.getByLabel('Snap')).toBeVisible();
		await expect(page.getByTestId('save-status')).toBeVisible();
		await page.getByRole('button', { name: 'Close menu' }).click();
		await expect(page.getByLabel('Snap')).toBeHidden();
	});
});

test.describe('desktop', () => {
	test('hiding the Symbols panel widens the stage and the reopen button brings it back', async ({
		page
	}) => {
		const stage = page.getByRole('application', { name: 'Stage canvas' });
		const before = (await stage.boundingBox())!.width;
		await page.getByRole('button', { name: 'Hide symbols' }).click();
		await expect(page.getByRole('complementary', { name: 'Symbols' })).toBeHidden();
		await expect.poll(async () => (await stage.boundingBox())!.width).toBeGreaterThan(before + 200);
		await page.getByRole('button', { name: 'Symbols', exact: true }).click();
		await expect(page.getByRole('complementary', { name: 'Symbols' })).toBeVisible();
		await expect.poll(async () => (await stage.boundingBox())!.width).toBeCloseTo(before, -1);
	});
});
