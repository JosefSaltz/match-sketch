import { test, expect } from '@playwright/test';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
});

test('drag a popper onto the bay', async ({ page }) => {
	const target = await bayPoint(page, 0.5, 0.5);
	await dragFromPalette(page, 'popper', target);
	const obj = page.getByTestId('object');
	await expect(obj).toHaveCount(1);
	await expect(obj).toHaveAttribute('data-symbol-id', 'popper');
});

test('shooting positions are numbered automatically', async ({ page }) => {
	await dragFromPalette(page, 'shooting-position', await bayPoint(page, 0.3, 0.8));
	await dragFromPalette(page, 'shooting-position', await bayPoint(page, 0.6, 0.8));
	await expect(page.getByTestId('object-label')).toHaveText(['SA-1', 'SA-2']);
});

test('search filters the palette', async ({ page }) => {
	await page.getByPlaceholder('Search symbols').fill('pepper');
	await expect(page.getByTestId('palette-item-popper')).toBeVisible();
	await expect(page.getByTestId('palette-item-wall')).toHaveCount(0);
});

test('dropping outside the stage places nothing', async ({ page }) => {
	const item = (await page.getByTestId('palette-item-barrel').boundingBox())!;
	await dragFromPalette(page, 'barrel', { x: item.x + item.width / 2, y: item.y + 60 });
	await expect(page.getByTestId('object')).toHaveCount(0);
});

test('tap a symbol then tap the bay to place it', async ({ page }) => {
	await page.getByTestId('palette-item-wall').click();
	await expect(page.getByTestId('palette-item-wall')).toHaveAttribute('aria-pressed', 'true');
	const p = await bayPoint(page, 0.5, 0.3);
	await page.mouse.click(p.x, p.y);
	await expect(page.getByTestId('object')).toHaveAttribute('data-symbol-id', 'wall');
});

test('popper variants are grouped in a collapsible family', async ({ page }) => {
	const poppers = page.getByRole('group', { name: 'Poppers' });
	await expect(poppers.getByTestId(/^palette-item-/)).toHaveCount(4);
	await page.getByRole('button', { name: 'Poppers', exact: true }).click();
	await expect(page.getByTestId('palette-item-popper-static')).toHaveCount(0);
	await page.getByPlaceholder('Search symbols').fill('static');
	await expect(page.getByTestId('palette-item-popper-static')).toBeVisible();
});

test('Escape cancels a palette drag without arming the symbol', async ({ page }) => {
	const item = page.getByTestId('palette-item-barrel');
	const box = (await item.boundingBox())!;
	const to = await bayPoint(page, 0.5, 0.5);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 10 });
	await page.keyboard.press('Escape');
	await page.mouse.up();
	await expect(page.getByTestId('object')).toHaveCount(0);
	await expect(item).toHaveAttribute('aria-pressed', 'false');
});
