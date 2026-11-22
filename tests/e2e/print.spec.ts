import { test, expect, type Page } from '@playwright/test';
import {
	bayPoint,
	createCanvas,
	createMatch,
	createPlanFromCanvas,
	dragFromPalette
} from './helpers';

const pages = (page: Page) => page.getByTestId('print-page');
const brief = (page: Page) => page.getByRole('tabpanel', { name: 'Brief' });
const props = (page: Page) => page.getByRole('tabpanel', { name: 'Properties' });

async function fillBrief(page: Page, fields: Record<string, string>) {
	await page.getByRole('tab', { name: 'Brief' }).click();
	for (const [label, value] of Object.entries(fields)) {
		await brief(page).getByLabel(label).fill(value);
	}
	await brief(page).getByLabel(Object.keys(fields)[0]).blur();
	await expect(page.getByTestId('save-status')).toHaveText('Saved');
	await page.getByRole('tab', { name: 'Properties' }).click();
}

async function openPrint(page: Page) {
	await page.getByRole('link', { name: 'Print' }).click();
	await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}\/print$/);
	await expect(pages(page).first()).toBeVisible();
}

test.describe('a 50 × 25 yd bay', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
		await createPlanFromCanvas(page, 'Bay A');
	});

	test('a short plan prints on one page in layout B', async ({ page }) => {
		await dragFromPalette(page, 'popper', await bayPoint(page, 0.4, 0.4));
		await dragFromPalette(page, 'barrel', await bayPoint(page, 0.6, 0.6));
		await fillBrief(page, {
			'Stage name': 'Bunker',
			'Stage number': '3',
			'Start position': 'Hands on X',
			'Stage procedure': 'Engage T1–T4.\nMove to Box B.'
		});
		await openPrint(page);
		await expect(pages(page)).toHaveCount(1);
		const p = pages(page).first();
		await expect(p).toContainText(/bunker/i);
		for (const label of ['START POSITION', 'GUN READY', 'ROUND COUNT', 'TARGETS', 'PAR TIME']) {
			await expect(p).toContainText(label);
		}
		await expect(p).toContainText('Hands on X');
		await expect(p).toContainText('1. Engage T1–T4.');
		await expect(p.locator('[data-print-object]')).toHaveCount(2);
		await expect(p).toContainText('Page 1 of 1');
	});

	test('a long procedure moves to page 2', async ({ page }) => {
		// Review Focus #1
		const steps = Array.from({ length: 40 }, (_, i) => `Step ${i + 1} of the course of fire`);
		await fillBrief(page, { 'Stage procedure': steps.join('\n') });
		await openPrint(page);
		await expect(pages(page)).toHaveCount(2);
		await expect(pages(page).nth(0)).toContainText('Stage procedure and notes on page 2');
		await expect(pages(page).nth(1)).toContainText('40. Step 40 of the course of fire');
	});

	test('plans show a diagram thumbnail on the home page and in a match', async ({ page }) => {
		await dragFromPalette(page, 'popper', await bayPoint(page, 0.4, 0.4));
		await dragFromPalette(page, 'barrel', await bayPoint(page, 0.6, 0.6));
		await expect(page.getByTestId('save-status')).toHaveText('Saved');
		await page.goto('/');
		const card = page.getByRole('region', { name: 'Unassigned plans' }).getByRole('listitem');
		const thumb = card.getByTestId('plan-thumbnail');
		await expect(thumb).toHaveAttribute('aria-label', 'Diagram of Untitled stage');
		await expect(thumb.locator('[data-print-object]')).toHaveCount(2);
		await createMatch(page, 'DRRC November');
		await page.getByRole('button', { name: 'Add existing plan' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
		const row = page.getByRole('region', { name: 'Stages' }).getByRole('listitem');
		await expect(row.getByTestId('plan-thumbnail').locator('[data-print-object]')).toHaveCount(2);
	});

	test('landscape pages are wider than tall', async ({ page }) => {
		await openPrint(page);
		await page.getByLabel('Orientation').selectOption({ label: 'Landscape' });
		const box = (await pages(page).first().boundingBox())!;
		expect(box.width).toBeGreaterThan(box.height);
	});
});

test.describe('a 40 × 300 yd bay', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await createCanvas(page, { name: 'Long bay', width: '40', depth: '300', unit: 'Yards' });
		await createPlanFromCanvas(page, 'Long bay');
	});

	test('tiling adds one page per tile after the overview', async ({ page }) => {
		await openPrint(page);
		await page.getByLabel('Diagram').selectOption({ label: 'Tile' });
		await page.getByLabel('Tile scale').selectOption({ label: '1 in = 10 yd' });
		const count = await pages(page).count();
		expect(count).toBeGreaterThan(2);
		const tileCount = count - 1;
		await expect(pages(page).nth(1)).toContainText(`Tile 1 of ${tileCount}`);
		await expect(pages(page).last()).toContainText(`Tile ${tileCount} of ${tileCount}`);
	});

	test('a plan with a scale break prints the strip and true distances', async ({ page }) => {
		// Review Focus #5
		await page.getByRole('combobox', { name: 'Snap' }).selectOption({ label: '1 yd' });
		await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.95));
		await props(page).getByLabel('Y').fill('150');
		await props(page).getByLabel('Y').press('Enter');
		await page.keyboard.press('Escape');
		await props(page).getByLabel('Not to scale beyond').fill('30');
		await props(page).getByLabel('Not to scale beyond').press('Enter');
		await expect(page.getByTestId('save-status')).toHaveText('Saved');
		await openPrint(page);
		await expect(pages(page).first()).toContainText('Not to scale beyond 30 yd');
		await expect(pages(page).first()).toContainText('150 yd');
	});
});

test.describe('print edges (final review)', () => {
	type Box = { x: number; y: number; width: number; height: number };
	const inside = (b: Box, f: Box) =>
		b.x >= f.x - 1 &&
		b.y >= f.y - 1 &&
		b.x + b.width <= f.x + f.width + 1 &&
		b.y + b.height <= f.y + f.height + 1;

	async function placeAt(page: Page, id: string, x: string, y: string) {
		await dragFromPalette(page, id, await bayPoint(page, 0.5, 0.5));
		for (const [label, v] of [
			['X', x],
			['Y', y]
		] as const) {
			await props(page).getByLabel(label).fill(v);
			await props(page).getByLabel(label).press('Enter');
		}
	}

	test('targets on the back line and objects at the sides print whole', async ({ page }) => {
		await page.goto('/');
		await createCanvas(page, { name: 'Deep bay', width: '40', depth: '100', unit: 'Yards' });
		await createPlanFromCanvas(page, 'Deep bay');
		await page.getByRole('combobox', { name: 'Symbol size' }).selectOption({ label: 'Large' });
		await placeAt(page, 'paper', '20', '99.67');
		await placeAt(page, 'paper', '0', '50');
		await placeAt(page, 'popper', '40', '50');
		await expect(page.getByTestId('save-status')).toHaveText('Saved');
		await openPrint(page);
		const frame = (await page.getByTestId('print-diagram-frame').first().boundingBox())!;
		for (const obj of await pages(page).first().locator('[data-print-object]').all()) {
			expect(inside((await obj.boundingBox())!, frame)).toBe(true);
		}
		const arrow = (await pages(page).first().getByText('Downrange').boundingBox())!;
		const back = (await pages(page).first().locator('[data-print-object]').first().boundingBox())!;
		expect(arrow.y + arrow.height).toBeLessThanOrEqual(back.y + 1);
	});

	test('tile pages show the downrange arrow and keep the start corner clear', async ({ page }) => {
		await page.goto('/');
		await createCanvas(page, { name: 'Long bay', width: '40', depth: '300', unit: 'Yards' });
		await createPlanFromCanvas(page, 'Long bay');
		await placeAt(page, 'shooting-position', '1', '1');
		await expect(page.getByTestId('save-status')).toHaveText('Saved');
		await openPrint(page);
		await page.getByLabel('Diagram').selectOption({ label: 'Tile' });
		await page.getByLabel('Tile scale').selectOption({ label: '1 in = 10 yd' });
		const tile = pages(page).nth(1);
		await expect(tile).toContainText('Downrange');
		const frame = (await tile.getByTestId('print-diagram-frame').boundingBox())!;
		const bar = (await tile.locator('[data-print-scalebar]').boundingBox())!;
		expect(bar.y + bar.height).toBeLessThanOrEqual(frame.y + 1);
		const sa = (await tile.locator('[data-print-object="shooting-position"]').boundingBox())!;
		expect(sa.y + sa.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
	});
});
