import { test, expect } from '@playwright/test';
import { createCanvas, createPlanFromCanvas, themeBaseRgb } from './helpers';

test('home has a patterned top bar with the page actions', async ({ page }) => {
	await page.goto('/');
	const bar = page.getByRole('banner');
	await expect(bar).toHaveCSS('background-color', await themeBaseRgb(page));
	await expect(bar.getByRole('img', { name: 'Match Sketch' })).toBeVisible();
	await expect(bar.getByRole('link', { name: 'New plan' })).toBeVisible();
	await expect(bar.getByRole('button', { name: 'New canvas' })).toBeVisible();
});

test('plans show as cards with a patterned header', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	await page.goto('/');
	const card = page.getByRole('region', { name: 'Plans' }).getByRole('listitem');
	await expect(card.locator('header')).toHaveCSS('background-color', await themeBaseRgb(page));
	await expect(card).toContainText('Untitled stage');
	await expect(card).toContainText('50 × 25 yd');
});

test('buttons are big enough to touch', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	await page.goto('/');
	for (const b of await page.getByRole('button').all()) {
		expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	}
	for (const l of await page.getByRole('link').all()) {
		expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	}
});

test('a dialog scrolls on a short screen so its buttons stay reachable', async ({ page }) => {
	await page.setViewportSize({ width: 800, height: 320 });
	await page.goto('/');
	await page.getByRole('button', { name: 'New canvas' }).click();
	// Playwright can scroll clipped content into view; a person needs the dialog itself to scroll.
	const scrollable = await page
		.getByRole('dialog')
		.evaluate(
			(el) =>
				el.scrollHeight > el.clientHeight &&
				['auto', 'scroll'].includes(getComputedStyle(el).overflowY)
		);
	expect(scrollable).toBe(true);
});

test('a field error is announced with its field', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'New canvas' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Save canvas' }).click();
	await expect(dialog.getByLabel('Name')).toHaveAccessibleDescription('Name is required');
});
