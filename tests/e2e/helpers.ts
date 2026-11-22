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

export type Point = { x: number; y: number };

/** A page point inside the bay: `fx` across from the left, `fyFromTop` down from the top edge. */
export async function bayPoint(page: Page, fx: number, fyFromTop: number): Promise<Point> {
	const box = (await page.getByTestId('bay').boundingBox())!;
	return { x: box.x + box.width * fx, y: box.y + box.height * fyFromTop };
}

/** Drags a palette item to a page point with the mouse. */
export async function dragFromPalette(page: Page, symbolId: string, to: Point): Promise<void> {
	const item = page.getByTestId(`palette-item-${symbolId}`);
	await item.scrollIntoViewIfNeeded();
	const box = (await item.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 10 });
	await page.mouse.up();
}

/** The current theme's base color as computed CSS reports it, e.g. "rgb(129, 97, 60)". */
export async function themeBaseRgb(page: Page): Promise<string> {
	const hex = (
		await page.evaluate(() =>
			getComputedStyle(document.documentElement).getPropertyValue('--theme-base')
		)
	).trim();
	const channel = (i: number) => parseInt(hex.slice(i, i + 2), 16);
	return `rgb(${channel(1)}, ${channel(3)}, ${channel(5)})`;
}
