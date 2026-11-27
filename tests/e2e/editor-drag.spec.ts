import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

const cursorOf = (l: Locator) => l.evaluate((el) => getComputedStyle(el).cursor);

/** Presses on an object's center and moves the mouse by (dx, dy) in steps, without releasing. */
async function grab(page: Page, target: Locator, dx: number, dy: number) {
	const o = (await target.boundingBox())!;
	await page.mouse.move(o.x + o.width / 2, o.y + o.height / 2);
	await page.mouse.down();
	await page.mouse.move(o.x + o.width / 2 + dx, o.y + o.height / 2 + dy, { steps: 8 });
}

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.5));
	await expect(page.getByTestId('object')).toHaveCount(1);
});

test('objects show an open hand, and a closed hand while dragged', async ({ page }) => {
	const object = page.getByTestId('object');
	expect(await cursorOf(object)).toBe('grab');
	await grab(page, object, 30, -20);
	expect(await cursorOf(page.locator('svg[data-stage]'))).toBe('grabbing');
	expect(await cursorOf(object)).toBe('grabbing');
	await page.mouse.up();
	expect(await cursorOf(object)).toBe('grab');
});

test('panning the view shows a closed hand', async ({ page }) => {
	const empty = await bayPoint(page, 0.1, 0.1);
	await page.mouse.move(empty.x, empty.y);
	await page.mouse.down();
	await page.mouse.move(empty.x + 40, empty.y + 30, { steps: 5 });
	expect(await cursorOf(page.locator('svg[data-stage]'))).toBe('grabbing');
	await page.mouse.up();
	expect(await cursorOf(page.locator('svg[data-stage]'))).not.toBe('grabbing');
});
