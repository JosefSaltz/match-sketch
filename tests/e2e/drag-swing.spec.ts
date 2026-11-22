import { test, expect } from '@playwright/test';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

// The rest of the suite runs with reduced motion so swings can't disturb measurements.
test.use({ reducedMotion: 'no-preference' });

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.3, 0.5));
	await expect(page.getByTestId('object')).toHaveCount(1);
});

async function whip(page: import('@playwright/test').Page) {
	const b = (await page.getByTestId('object').boundingBox())!;
	const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
	await page.mouse.move(x, y);
	await page.mouse.down();
	for (let i = 1; i <= 8; i++) await page.mouse.move(x + i * 30, y);
}

test('a dragged object swings as the pointer whips sideways, then settles upright', async ({
	page
}) => {
	const obj = page.getByTestId('object');
	await whip(page);
	await expect(obj).toHaveAttribute('transform', /rotate\(-?[1-9]/);
	await page.mouse.up();
	await expect(obj).not.toHaveAttribute('transform', /rotate\(/, { timeout: 4000 });
	await expect(
		page.getByRole('tabpanel', { name: 'Properties' }).getByLabel('Rotation (°)')
	).toHaveValue('0');
});

test('with reduced motion nothing swings', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.reload();
	const obj = page.getByTestId('object');
	await whip(page);
	await page.waitForTimeout(100);
	expect(await obj.getAttribute('transform')).not.toMatch(/rotate\(/);
	await page.mouse.up();
});

test('a symbol dragged out of the palette swings too', async ({ page }) => {
	const item = page.getByTestId('palette-item-barrel');
	await item.scrollIntoViewIfNeeded();
	const b = (await item.boundingBox())!;
	await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
	await page.mouse.down();
	for (let i = 1; i <= 8; i++)
		await page.mouse.move(b.x + b.width / 2 + i * 35, b.y + b.height / 2);
	await expect(page.getByTestId('palette-ghost')).toHaveAttribute('style', /rotate\(-?[1-9]/);
	await page.mouse.up();
});
