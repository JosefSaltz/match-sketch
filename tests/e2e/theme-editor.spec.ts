import { test, expect } from '@playwright/test';
import { createCanvas, createPlanFromCanvas, themeBaseRgb } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
});

test('the editor bar is themed and the wordmark links home', async ({ page }) => {
	await expect(page.getByRole('banner')).toHaveCSS('background-color', await themeBaseRgb(page));
	await page.getByRole('link', { name: 'Match Sketch' }).click();
	await expect(page).toHaveURL(/\/$/);
});

test('the side panels start with patterned strips', async ({ page }) => {
	const base = await themeBaseRgb(page);
	const heading = page
		.getByRole('complementary', { name: 'Symbols' })
		.getByRole('heading', { name: 'Symbols' });
	await expect(heading).toBeVisible();
	await expect(heading.locator('..')).toHaveCSS('background-color', base);
	// The right column's strip holds its tabs (Properties | Brief).
	const tabs = page.getByRole('complementary', { name: 'Inspector' }).getByRole('tablist');
	await expect(tabs.getByRole('tab', { name: 'Properties' })).toBeVisible();
	await expect(tabs).toHaveCSS('background-color', base);
});

test('the stage stays white under a patterned theme (Review Focus #1)', async ({ page }) => {
	await page.getByRole('button', { name: 'Theme' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Blackout' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'blackout');
	await expect(page.getByTestId('bay')).toHaveCSS('fill', 'rgb(255, 255, 255)');
});

test('palette controls are touch-sized', async ({ page }) => {
	const palette = page.getByRole('complementary', { name: 'Symbols' });
	for (const b of await palette.getByRole('button').all()) {
		expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	}
});

test.describe('tablet', () => {
	test.use({ viewport: { width: 1024, height: 768 } });

	test('the top bar fits and its controls are touch-sized (Review Focus #4)', async ({ page }) => {
		const bar = page.getByRole('banner');
		expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
		for (const c of await bar.locator('button, select, a').all()) {
			expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		}
	});
});
