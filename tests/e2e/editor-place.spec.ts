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

test('placed objects keep their symbols and places across a reload', async ({ page }) => {
	// Review Focus #1: ids from Plan 1 still name the same entries after the redraw.
	const ids = ['popper', 'barrel', 'wall', 'start-box'];
	for (const [i, id] of ids.entries()) {
		await dragFromPalette(page, id, await bayPoint(page, 0.2 + i * 0.2, 0.5));
	}
	await expect(page.getByTestId('object')).toHaveCount(4);
	const before = await page
		.getByTestId('object')
		.evaluateAll((els) => els.map((e) => `${e.dataset.symbolId} ${e.getAttribute('transform')}`));
	await page.reload();
	await expect(page.getByTestId('object')).toHaveCount(4);
	const after = await page
		.getByTestId('object')
		.evaluateAll((els) => els.map((e) => `${e.dataset.symbolId} ${e.getAttribute('transform')}`));
	expect(after).toEqual(before);
	// The start box marks its downrange edge.
	await expect(page.locator('[data-symbol-id="start-box"] path')).toHaveCount(1);
});

test('every footprint can be selected by clicking inside it', async ({ page }) => {
	// Final review: line-drawn footprints (door, low barrier, a wall's port) must stay clickable.
	const footprints = [
		'wall',
		'wall-port',
		'half-wall-port',
		'v-wall',
		'door',
		'car',
		'table',
		'pallet',
		'chopper-seat',
		'plank',
		'stairs',
		'platform',
		'wobble',
		'barrier',
		'berm',
		'fence',
		'shooting-box',
		'start-box',
		'fault-line'
	];
	const missed: string[] = [];
	for (const id of footprints) {
		await dragFromPalette(page, id, await bayPoint(page, 0.5, 0.5));
		const obj = page.locator(`[data-symbol-id="${id}"]`);
		await expect(obj).toHaveCount(1);
		const empty = await bayPoint(page, 0.05, 0.05);
		await page.mouse.click(empty.x, empty.y);
		await expect(page.getByTestId('selection')).toHaveCount(0);
		const b = (await obj.boundingBox())!;
		await page.mouse.click(b.x + b.width * 0.62, b.y + b.height * 0.35);
		if ((await page.getByTestId('selection').count()) !== 1) missed.push(id);
		// Undo the placement so the next one lands on clear ground.
		await page.getByRole('button', { name: 'Undo' }).click();
		await expect(page.getByTestId('object')).toHaveCount(0);
	}
	expect(missed).toEqual([]);
});
