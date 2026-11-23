import { expect, test } from './fixtures';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
});

test('undo and redo a move', async ({ page }) => {
	await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.5));
	const obj = page.getByTestId('object');
	const b0 = (await obj.boundingBox())!;
	await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
	await page.mouse.down();
	await page.mouse.move(b0.x + b0.width / 2 + 100, b0.y + b0.height / 2, { steps: 5 });
	await page.mouse.up();
	await page.keyboard.press('Control+z');
	expect((await obj.boundingBox())!.x).toBeCloseTo(b0.x, 0);
	await page.getByRole('button', { name: 'Redo' }).click();
	expect((await obj.boundingBox())!.x).toBeGreaterThan(b0.x + 50);
	await page.getByRole('button', { name: 'Undo' }).click();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(obj).toHaveCount(0);
});

test('an edit survives an immediate reload', async ({ page }) => {
	// Review Focus #4
	await dragFromPalette(page, 'barrel', await bayPoint(page, 0.4, 0.6));
	await page.reload();
	await expect(page.getByTestId('object')).toHaveAttribute('data-symbol-id', 'barrel');
});

test('save status settles on Saved', async ({ page }) => {
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.5));
	await expect(page.getByTestId('save-status')).toHaveText('Saved');
});
