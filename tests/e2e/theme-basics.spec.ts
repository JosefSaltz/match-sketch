import { test, expect } from '@playwright/test';
import { createCanvas, createPlanFromCanvas } from './helpers';

test('the home page shows the wordmark in Graduate', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('img', { name: 'Match Sketch' })).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
	expect(await page.evaluate(() => document.fonts.check('30px Graduate'))).toBe(true);
});

test('no request leaves the app origin', async ({ page, baseURL }) => {
	// Review Focus #5: fonts and tiles are self-hosted so the app works offline.
	const outside: string[] = [];
	page.on('request', (r) => {
		const url = r.url();
		if (!url.startsWith(baseURL!) && !url.startsWith('data:')) outside.push(url);
	});
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	expect(outside).toEqual([]);
});
