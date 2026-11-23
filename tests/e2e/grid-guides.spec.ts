import { expect, test } from './fixtures';
import { createCanvas, createPlanFromCanvas } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Range', width: '50', depth: '100', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Range');
});

test('guides every 25 yd label the range and stay after a reload', async ({ page }) => {
	const grid = page.getByRole('combobox', { name: 'Grid' });
	await expect(grid).toHaveValue('fine');
	await grid.selectOption({ label: 'Every 25 yd' });
	await expect(page.getByTestId('guide-label')).toHaveText(['25 yd', '50 yd', '75 yd']);
	await expect(page.getByTestId('save-status')).toHaveText('Saved');
	await page.reload();
	await expect(page.getByRole('combobox', { name: 'Grid' })).toHaveValue('75');
	await expect(page.getByTestId('guide-label')).toHaveCount(3);
});

test('the grid can be turned off and back to fine', async ({ page }) => {
	const grid = page.getByRole('combobox', { name: 'Grid' });
	const lines = page.locator('[data-testid="grid"] line');
	expect(await lines.count()).toBeGreaterThan(0);
	await grid.selectOption({ label: 'Off' });
	await expect(lines).toHaveCount(0);
	await expect(page.getByTestId('guide-label')).toHaveCount(0);
	await grid.selectOption({ label: 'Fine' });
	expect(await lines.count()).toBeGreaterThan(0);
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(lines).toHaveCount(0);
});

test('guides print with their labels', async ({ page }) => {
	await page.getByRole('combobox', { name: 'Grid' }).selectOption({ label: 'Every 25 yd' });
	await expect(page.getByTestId('save-status')).toHaveText('Saved');
	await page.getByRole('link', { name: 'Print' }).click();
	const p = page.getByTestId('print-page').first();
	await expect(p).toBeVisible();
	for (const label of ['25 yd', '50 yd', '75 yd']) await expect(p).toContainText(label);
});
