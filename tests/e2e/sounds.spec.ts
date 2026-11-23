import { expect, test } from './fixtures';

test('a tuned drag sound is kept across a reload', async ({ page }) => {
	await page.goto('/sounds');
	await expect(page.getByRole('heading', { level: 1, name: 'Drag sound' })).toBeVisible();
	const decay = page.getByLabel('Decay');
	await decay.fill('120');
	await expect(page.locator('output[for="snd-decayMs"]')).toHaveText('120 ms');
	await page.getByLabel('Waveform').selectOption('sine');
	await page.reload();
	await expect(page.locator('output[for="snd-decayMs"]')).toHaveText('120 ms');
	await expect(page.getByLabel('Waveform')).toHaveValue('sine');

	await page.getByRole('button', { name: 'Reset' }).click();
	await expect(page.locator('output[for="snd-decayMs"]')).toHaveText('28 ms');
	await expect(page.getByLabel('Waveform')).toHaveValue('triangle');
});
