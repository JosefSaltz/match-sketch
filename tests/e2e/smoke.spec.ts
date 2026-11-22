import { expect, test } from './fixtures';

test('home shows the app name', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Match Sketch' })).toBeVisible();
});
