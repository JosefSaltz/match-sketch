import { expect, test } from './fixtures';
import { THEMES } from '../../src/lib/theme/themes';
import { themeBaseRgb } from './helpers';

const pick = async (page: import('@playwright/test').Page, name: string) => {
	await page.getByRole('button', { name: 'Theme' }).click();
	await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
};

test('the default theme is Woodland DPM', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dpm');
	await expect(page.getByRole('banner')).toHaveCSS('background-image', /\/themes\/dpm\.webp/);
});

test('a camo theme paints its tile on the top bar', async ({ page }) => {
	await page.goto('/');
	await pick(page, 'Tiger Stripe');
	await expect(page.getByRole('banner')).toHaveCSS(
		'background-image',
		/\/themes\/tiger-stripe\.webp/
	);
});

test('a tile that fails to load leaves the base color (Review Focus #3)', async ({ page }) => {
	await page.route('**/themes/*.webp', (route) => route.abort());
	await page.goto('/');
	await pick(page, 'Woodland DPM');
	await expect(page.getByRole('banner')).toHaveCSS('background-color', await themeBaseRgb(page));
	await expect(page.getByRole('banner').getByRole('img', { name: 'Match Sketch' })).toBeVisible();
});

test('every theme tile is served', async ({ page }) => {
	const tiled = THEMES.filter((t) => t.tile);
	expect(tiled.length).toBeGreaterThanOrEqual(10);
	for (const t of tiled) {
		const res = await page.request.get(t.tile!.src);
		expect(res.status(), t.id).toBe(200);
	}
});

test('the picker lists plaid and camo families', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Theme' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('group', { name: 'Plaid' }).getByRole('button')).toHaveCount(3);
	await expect(dialog.getByRole('group', { name: 'Camo' }).getByRole('button')).toHaveCount(7);
});
