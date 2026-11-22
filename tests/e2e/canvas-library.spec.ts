import { expect, test } from './fixtures';
import { createCanvas } from './helpers';

test('create a canvas and keep it after reload', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	const row = page.getByRole('listitem').filter({ hasText: 'Bay A' });
	await expect(row).toContainText('50 × 25 yd');
	await page.reload();
	await expect(row).toContainText('50 × 25 yd');
});

test('rejects bad dimensions and saves nothing', async ({ page }) => {
	// Review Focus #3
	await page.goto('/');
	await page.getByRole('button', { name: 'New canvas' }).click();
	await page.getByLabel('Name').fill('Bad');
	await page.getByLabel('Unit').selectOption({ label: 'Yards' });
	for (const v of ['', '0', '-5', 'abc', '1001']) {
		await page.getByLabel('Width').fill(v);
		await page.getByLabel('Depth').fill('25');
		await page.getByRole('button', { name: 'Save canvas' }).click();
		await expect(page.getByText('Enter a width between 1 and 1000 yd')).toBeVisible();
	}
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('listitem').filter({ hasText: 'Bad' })).toHaveCount(0);
});

test('edit and delete a canvas', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	const row = page.getByRole('listitem').filter({ hasText: 'Bay A' });
	await row.getByRole('button', { name: 'Edit' }).click();
	await page.getByLabel('Width').fill('60');
	await page.getByRole('button', { name: 'Save canvas' }).click();
	await expect(row).toContainText('60 × 25 yd');
	await row.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(row).toHaveCount(0);
});
