import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

/** Downloads the preview's PDF and returns its text (PDF objects are plain text here). */
async function downloadPdfText(page: Page): Promise<string> {
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Download PDF' }).click()
	]);
	expect(download.suggestedFilename()).toMatch(/\.pdf$/);
	return (await readFile(await download.path())).toString('latin1');
}

const pageCount = (pdf: string) => (pdf.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

async function openPrint(page: Page) {
	await page.getByRole('link', { name: 'Print' }).click();
	await expect(page.getByTestId('print-page').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.5));
});

test('the PDF has the same pages as the preview and no raster images', async ({ page }) => {
	// Review Focus #3
	await openPrint(page);
	const pdf = await downloadPdfText(page);
	expect(pdf.startsWith('%PDF')).toBe(true);
	expect(pageCount(pdf)).toBe(await page.getByTestId('print-page').count());
	expect(pdf).not.toMatch(/\/Subtype\s*\/Image/);
});

test('a two-page plan makes a two-page PDF', async ({ page }) => {
	await page.getByRole('tab', { name: 'Brief' }).click();
	const steps = Array.from({ length: 40 }, (_, i) => `Step ${i + 1} of the course of fire`);
	const field = page.getByRole('tabpanel', { name: 'Brief' }).getByLabel('Stage procedure');
	await field.fill(steps.join('\n'));
	await field.blur();
	await expect(page.getByTestId('save-status')).toHaveText('Saved');
	await openPrint(page);
	await expect(page.getByTestId('print-page')).toHaveCount(2);
	expect(pageCount(await downloadPdfText(page))).toBe(2);
});

test('the PDF downloads with the network off', async ({ page, context }) => {
	await openPrint(page);
	await context.setOffline(true);
	const pdf = await downloadPdfText(page);
	expect(pageCount(pdf)).toBe(1);
	await context.setOffline(false);
});
