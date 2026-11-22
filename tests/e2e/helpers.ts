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

/** From the home page: new plan on a saved canvas; returns the new plan's id. */
export async function createPlanFromCanvas(page: Page, canvasName: string): Promise<string> {
	await page.getByRole('link', { name: 'New plan' }).click();
	await page.getByLabel('Use a saved canvas').check();
	await page.getByRole('combobox', { name: 'Canvas' }).selectOption({ label: canvasName });
	await page.getByRole('button', { name: 'Create plan' }).click();
	await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}$/);
	await expect(page.getByTestId('bay')).toBeVisible();
	return page.url().split('/').at(-1)!;
}
