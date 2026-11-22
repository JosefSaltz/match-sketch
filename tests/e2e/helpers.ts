import { expect, type Page } from '@playwright/test';

export type CanvasFields = { name: string; width: string; depth: string; unit: 'Feet' | 'Yards' };

/** Creates a canvas from the home page's "New canvas" dialog. */
export async function createCanvas(page: Page, c: CanvasFields): Promise<void> {
	await page.getByRole('button', { name: 'New canvas' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Name').fill(c.name);
	await dialog.getByLabel('Unit').selectOption({ label: c.unit });
	await dialog.getByLabel('Width').fill(c.width);
	await dialog.getByLabel('Depth').fill(c.depth);
	await dialog.getByRole('button', { name: 'Save canvas' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
}
