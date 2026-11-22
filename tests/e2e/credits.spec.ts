import { test, expect } from '@playwright/test';

test('credits show the OGL statement and the font license', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'About & credits' }).click();
	const dialog = page.getByRole('dialog', { name: 'About & credits' });
	await expect(dialog).toContainText(
		'Contains public sector information licensed under the Open Government Licence v1.0'
	);
	await expect(dialog).toContainText('SIL Open Font License');
	await expect(dialog.getByRole('link', { name: /Woodland DPM/ })).toHaveAttribute(
		'href',
		/commons\.wikimedia\.org/
	);
});

test('credits open from the theme picker too', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Theme' }).click();
	await page
		.getByRole('dialog', { name: 'Theme' })
		.getByRole('button', { name: 'Credits' })
		.click();
	await expect(page.getByRole('dialog', { name: 'About & credits' })).toBeVisible();
});
