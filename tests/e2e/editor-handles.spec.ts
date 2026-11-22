import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

const props = (page: Page) => page.getByRole('tabpanel', { name: 'Properties' });

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	// Sizes show in the plan's unit (yards), so snap to whole yards to see whole numbers.
	await page.getByRole('combobox', { name: 'Snap' }).selectOption({ label: '1 yd' });
	await dragFromPalette(page, 'wall', await bayPoint(page, 0.5, 0.5));
	await expect(page.getByTestId('selection')).toHaveCount(1);
});

test('dragging the ne handle widens the wall', async ({ page }) => {
	const w0 = Number(await props(page).getByLabel('Width').inputValue());
	const h = (await page.getByTestId('handle-ne').boundingBox())!;
	await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
	await page.mouse.down();
	await page.mouse.move(h.x + h.width / 2 + 80, h.y + h.height / 2, { steps: 5 });
	await page.mouse.up();
	const w1 = Number(await props(page).getByLabel('Width').inputValue());
	expect(w1).toBeGreaterThan(w0);
	expect(w1 % 1).toBe(0);
});

test('dragging the rotate handle to the right rotates to 90°', async ({ page }) => {
	const o = (await page.getByTestId('object').boundingBox())!;
	const h = (await page.getByTestId('handle-rotate').boundingBox())!;
	await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
	await page.mouse.down();
	await page.mouse.move(o.x + o.width / 2 + 150, o.y + o.height / 2, { steps: 8 });
	await page.mouse.up();
	await expect(props(page).getByLabel('Rotation (°)')).toHaveValue('90');
});

test('symbols have a rotate handle but no corner handles', async ({ page }) => {
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.2, 0.2));
	await page.locator('[data-testid="object"][data-symbol-id="popper"]').click();
	await expect(page.getByTestId('handle-rotate')).toHaveCount(1);
	await expect(page.getByTestId('handle-ne')).toHaveCount(0);
});

test('handles are big enough to touch', async ({ page }) => {
	for (const id of ['handle-rotate', 'handle-ne', 'handle-sw']) {
		const b = (await page.getByTestId(id).boundingBox())!;
		expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(24);
	}
});

test('grabbing a handle off-centre does not jump the size', async ({ page }) => {
	await page.getByRole('combobox', { name: 'Snap' }).selectOption({ label: 'Off' });
	await page.getByTestId('object').click();
	const w0 = Number(await props(page).getByLabel('Width').inputValue());
	const h = (await page.getByTestId('handle-ne').boundingBox())!;
	await page.mouse.move(h.x + h.width / 2 + 9, h.y + h.height / 2);
	await page.mouse.down();
	await page.mouse.move(h.x + h.width / 2 + 10, h.y + h.height / 2, { steps: 2 });
	await page.mouse.up();
	const w1 = Number(await props(page).getByLabel('Width').inputValue());
	expect(Math.abs(w1 - w0)).toBeLessThan(0.15);
});
