import { test, expect } from '@playwright/test';
import { createCanvas, createPlanFromCanvas } from './helpers';

test('plan from a saved canvas opens the editor at the right shape', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await page.getByRole('link', { name: 'New plan' }).click();
	await page.getByLabel('Use a saved canvas').check();
	await page.getByRole('combobox', { name: 'Canvas' }).selectOption({ label: 'Bay A' });
	await page.getByRole('button', { name: 'Create plan' }).click();
	await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}$/);
	await expect(page.getByText('50 × 25 yd')).toBeVisible();
	const box = (await page.getByTestId('bay').boundingBox())!;
	expect(box.width / box.height).toBeCloseTo(2, 1);
	await expect(page.getByTestId('scale-bar')).toContainText('yd');
});

test('new canvas saved to the library from the new plan flow', async ({ page }) => {
	await page.goto('/plans/new');
	await page.getByLabel('New canvas').check();
	await page.getByLabel('Name').fill('Rifle bay');
	await page.getByLabel('Width').fill('100');
	await page.getByLabel('Depth').fill('300');
	await page.getByLabel('Unit').selectOption({ label: 'Yards' });
	await page.getByLabel('Save to my canvas library').check();
	await page.getByRole('button', { name: 'Create plan' }).click();
	await expect(page.getByTestId('bay')).toBeVisible();
	await page.goto('/');
	await expect(page.getByRole('listitem').filter({ hasText: 'Rifle bay' })).toContainText(
		'100 × 300 yd'
	);
});

test('very long bay still fits and draws a sane grid', async ({ page }) => {
	// Review Focus #2
	await page.goto('/plans/new');
	await page.getByLabel('New canvas').check();
	await page.getByLabel('Name').fill('Long');
	await page.getByLabel('Width').fill('50');
	await page.getByLabel('Depth').fill('1000');
	await page.getByLabel('Unit').selectOption({ label: 'Yards' });
	await page.getByRole('button', { name: 'Create plan' }).click();
	await expect(page.getByTestId('bay')).toBeVisible();
	const bay = (await page.getByTestId('bay').boundingBox())!;
	const vp = page.viewportSize()!;
	expect(bay.height).toBeLessThanOrEqual(vp.height);
	expect(await page.locator('[data-testid="grid"] line').count()).toBeLessThan(400);
});

test('zoom and fit', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	const w0 = (await page.getByTestId('bay').boundingBox())!.width;
	await page.getByRole('button', { name: 'Zoom in' }).click();
	expect((await page.getByTestId('bay').boundingBox())!.width).toBeGreaterThan(w0);
	await page.getByRole('button', { name: 'Fit' }).click();
	expect((await page.getByTestId('bay').boundingBox())!.width).toBeCloseTo(w0, 0);
});

test('plans list: duplicate and delete', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	await page.goto('/');
	const plans = page.getByRole('region', { name: 'Unassigned plans' });
	await plans.getByRole('button', { name: 'Duplicate' }).click();
	await expect(plans.getByText('Untitled stage (copy)')).toBeVisible();
	await plans
		.getByRole('listitem')
		.filter({ hasText: '(copy)' })
		.getByRole('button', { name: 'Delete' })
		.click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(plans.getByRole('listitem')).toHaveCount(1);
});

test('zoom in grows even a tiny bay', async ({ page }) => {
	// Review Focus #2: on a large screen a 3 × 3 ft bay fits at a scale above the old zoom maximum.
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto('/plans/new');
	await page.getByLabel('New canvas').check();
	await page.getByLabel('Name').fill('Tiny');
	await page.getByLabel('Width').fill('3');
	await page.getByLabel('Depth').fill('3');
	await page.getByLabel('Unit').selectOption({ label: 'Feet' });
	await page.getByRole('button', { name: 'Create plan' }).click();
	await expect(page.getByTestId('bay')).toBeVisible();
	const w0 = (await page.getByTestId('bay').boundingBox())!.width;
	await page.getByRole('button', { name: 'Zoom in' }).click();
	expect((await page.getByTestId('bay').boundingBox())!.width).toBeGreaterThan(w0);
	const bar = (await page.getByTestId('scale-bar').boundingBox())!;
	expect(bar.width).toBeLessThan(200);
});
