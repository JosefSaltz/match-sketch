import { expect, test } from './fixtures';
import { DEFAULT_THEME_ID } from '../../src/lib/theme/themes';

test('choosing a theme applies it and survives a reload', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Theme' }).click();
	const picker = page.getByRole('dialog', { name: 'Theme' });
	await picker.getByRole('button', { name: 'Ranger Green' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'ranger-green');
	await expect(picker.getByRole('button', { name: 'Ranger Green' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'ranger-green');
});

test('a saved theme that no longer exists opens in the default (Review Focus #2)', async ({
	page
}) => {
	await page.goto('/');
	// The app has applied a theme once it has opened (and created) the database.
	await expect(page.locator('html')).toHaveAttribute('data-theme', DEFAULT_THEME_ID);
	await page.evaluate(async () => {
		const req = indexedDB.open('match-sketch');
		await new Promise((resolve) => (req.onsuccess = resolve));
		const tx = req.result.transaction('settings', 'readwrite');
		tx.objectStore('settings').put({ key: 'theme', value: 'retired-camo', updatedAt: '' });
		await new Promise((resolve) => (tx.oncomplete = resolve));
		req.result.close();
	});
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', DEFAULT_THEME_ID);
});

test('the picker groups themes by family', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Theme' }).click();
	const picker = page.getByRole('dialog', { name: 'Theme' });
	await expect(picker.getByRole('group', { name: 'Solid' })).toBeVisible();
	await expect(picker.getByRole('group', { name: 'Solid' }).getByRole('button')).toHaveCount(5);
});

test('the picker marks the current theme after moving between screens', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Theme' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Fudd Orange' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
	await page.getByRole('link', { name: 'New plan' }).click();
	await page.getByRole('button', { name: 'Theme' }).click();
	await expect(
		page.getByRole('dialog').getByRole('button', { name: 'Fudd Orange' })
	).toHaveAttribute('aria-pressed', 'true');
});
