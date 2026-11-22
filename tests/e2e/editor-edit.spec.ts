import { test, expect, type Page } from '@playwright/test';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

const props = (page: Page) => page.getByRole('complementary', { name: 'Properties' });

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.5));
	await expect(page.getByTestId('object')).toHaveCount(1);
});

test('select shows properties; count shows a badge', async ({ page }) => {
	await page.getByTestId('object').click();
	await expect(props(page).getByLabel('Count')).toHaveValue('1');
	await props(page).getByLabel('Count').fill('3');
	await props(page).getByLabel('Count').press('Enter');
	await expect(page.getByTestId('object-count')).toHaveText('×3');
});

test('moving with 1 yd snap lands on whole yards', async ({ page }) => {
	await page.getByRole('combobox', { name: 'Snap' }).selectOption({ label: '1 yd' });
	const o = (await page.getByTestId('object').boundingBox())!;
	await page.mouse.move(o.x + o.width / 2, o.y + o.height / 2);
	await page.mouse.down();
	await page.mouse.move(o.x + o.width / 2 + 37, o.y + o.height / 2 - 23, { steps: 5 });
	await page.mouse.up();
	expect(Number(await props(page).getByLabel('X').inputValue()) % 1).toBe(0);
	expect(Number(await props(page).getByLabel('Y').inputValue()) % 1).toBe(0);
});

test('rotation field rotates the object', async ({ page }) => {
	await page.getByTestId('object').click();
	const rot = props(page).getByLabel('Rotation (°)');
	await rot.fill('90');
	await rot.press('Enter');
	await expect(page.getByTestId('object').locator('[transform*="rotate(90"]')).toHaveCount(1);
});

test('Backspace in the Label field edits text, not the stage', async ({ page }) => {
	// Review Focus #1
	await page.getByTestId('object').click();
	const label = props(page).getByLabel('Label');
	await label.fill('T1');
	await label.press('Backspace');
	await expect(page.getByTestId('object')).toHaveCount(1);
	await expect(label).toHaveValue('T');
});

test('Delete key removes, Ctrl+D duplicates', async ({ page }) => {
	await page.getByTestId('object').click();
	await page.keyboard.press('Control+d');
	await expect(page.getByTestId('object')).toHaveCount(2);
	await page.keyboard.press('Delete');
	await expect(page.getByTestId('object')).toHaveCount(1);
});

test('symbol size Large draws a bigger glyph', async ({ page }) => {
	const w0 = (await page.getByTestId('object').boundingBox())!.width;
	await page.getByRole('combobox', { name: 'Symbol size' }).selectOption({ label: 'Large' });
	expect((await page.getByTestId('object').boundingBox())!.width).toBeGreaterThan(w0);
});

test.describe('touch', () => {
	// Review Focus #5
	test.use({ hasTouch: true, viewport: { width: 1180, height: 820 } });
	test('tap selects and a touch drag moves', async ({ page }) => {
		const o = (await page.getByTestId('object').boundingBox())!;
		await page.touchscreen.tap(o.x + o.width / 2, o.y + o.height / 2);
		await expect(page.getByTestId('selection')).toHaveCount(1);
		const x0 = await props(page).getByLabel('X').inputValue();
		const at = (dx: number) => ({
			pointerType: 'touch',
			isPrimary: true,
			pointerId: 7,
			bubbles: true,
			clientX: o.x + o.width / 2 + dx,
			clientY: o.y + o.height / 2
		});
		await page.getByTestId('object').dispatchEvent('pointerdown', at(0));
		await page.getByTestId('object').dispatchEvent('pointermove', at(40));
		await page.getByTestId('object').dispatchEvent('pointerup', at(40));
		await expect(props(page).getByLabel('X')).not.toHaveValue(x0);
	});
});

test('a second pointer during a drag keeps the selection', async ({ page }) => {
	const o = (await page.getByTestId('object').boundingBox())!;
	const empty = await bayPoint(page, 0.1, 0.1);
	const ev = (id: number, x: number, y: number) => ({
		pointerType: 'touch',
		isPrimary: id === 7,
		pointerId: id,
		bubbles: true,
		clientX: x,
		clientY: y
	});
	const stage = page.locator('svg[data-stage]');
	await page
		.getByTestId('object')
		.dispatchEvent('pointerdown', ev(7, o.x + o.width / 2, o.y + o.height / 2));
	await stage.dispatchEvent('pointerdown', ev(8, empty.x, empty.y));
	await stage.dispatchEvent('pointerup', ev(8, empty.x, empty.y));
	await page
		.getByTestId('object')
		.dispatchEvent('pointerup', ev(7, o.x + o.width / 2, o.y + o.height / 2));
	await expect(page.getByTestId('selection')).toHaveCount(1);
});

test('a typed label is kept when you click the stage', async ({ page }) => {
	await page.getByTestId('object').click();
	await props(page).getByLabel('Label').fill('Z9');
	const empty = await bayPoint(page, 0.1, 0.1);
	await page.mouse.click(empty.x, empty.y);
	await expect(page.getByTestId('object-label')).toHaveText('Z9');
});

test('a count above the maximum shows the clamped value', async ({ page }) => {
	await page.getByTestId('object').click();
	const count = props(page).getByLabel('Count');
	await count.fill('99');
	await count.press('Enter');
	await count.fill('150');
	await count.press('Enter');
	await expect(count).toHaveValue('99');
});

test('tapping one of several selected objects selects just it', async ({ page }) => {
	await page.getByTestId('object').click();
	await page.keyboard.press('Control+d');
	const original = page.getByTestId('object').first();
	await original.click({ modifiers: ['Shift'] });
	await expect(page.getByTestId('selection')).toHaveCount(2);
	await original.click();
	await expect(page.getByTestId('selection')).toHaveCount(1);
});

test('a typed label is kept when you click another object', async ({ page }) => {
	await page.getByTestId('object').click();
	await page.keyboard.press('Control+d');
	const [original, copy] = [page.getByTestId('object').first(), page.getByTestId('object').last()];
	await original.click();
	await props(page).getByLabel('Label').fill('Z9');
	await copy.click();
	await expect(original.getByTestId('object-label')).toHaveText('Z9');
});
