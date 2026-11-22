import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
	bayPoint,
	createCanvas,
	createPlanFromCanvas,
	dragFromPalette,
	type Point
} from './helpers';

const props = (page: Page) => page.getByRole('tabpanel', { name: 'Properties' });
const labels = (page: Page) =>
	page.locator('[data-testid="annotation"][data-annotation-type="text"]');

async function placeLabel(page: Page, fx: number, fy: number) {
	await page.getByTestId('tool-text').click();
	const p = await bayPoint(page, fx, fy);
	await page.mouse.click(p.x, p.y);
}

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
});

test.describe('text labels', () => {
	test('place, edit, move and delete a text label', async ({ page }) => {
		await placeLabel(page, 0.3, 0.5);
		await expect(labels(page)).toHaveCount(1);
		await expect(page.getByTestId('annotation-text')).toHaveText('Text');
		await expect(props(page).getByRole('heading', { name: 'Text label' })).toBeVisible();
		const text = props(page).getByLabel('Text');
		await text.fill('Hard cover');
		await text.press('Enter');
		await expect(page.getByTestId('annotation-text')).toHaveText('Hard cover');

		const b0 = (await page.getByTestId('annotation-text').boundingBox())!;
		await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
		await page.mouse.down();
		await page.mouse.move(b0.x + b0.width / 2 + 40, b0.y + b0.height / 2, { steps: 5 });
		await page.mouse.up();
		const b1 = (await page.getByTestId('annotation-text').boundingBox())!;
		expect(b1.x).toBeGreaterThan(b0.x + 20);

		await page.keyboard.press('Delete');
		await expect(labels(page)).toHaveCount(0);
		await page.getByRole('button', { name: 'Undo' }).click();
		await expect(labels(page)).toHaveCount(1);
	});

	test('the label tool disarms after one placement and with Escape', async ({ page }) => {
		const tool = page.getByTestId('tool-text');
		await tool.click();
		await expect(tool).toHaveAttribute('aria-pressed', 'true');
		const p = await bayPoint(page, 0.3, 0.5);
		await page.mouse.click(p.x, p.y);
		await expect(tool).toHaveAttribute('aria-pressed', 'false');
		await tool.click();
		await page.keyboard.press('Escape');
		await expect(tool).toHaveAttribute('aria-pressed', 'false');
		const q = await bayPoint(page, 0.6, 0.5);
		await page.mouse.click(q.x, q.y);
		await expect(labels(page)).toHaveCount(1);
	});

	test('arming a tool disarms a symbol and the other way round', async ({ page }) => {
		await page.getByTestId('palette-item-popper').click();
		await page.getByTestId('tool-measure').click();
		await expect(page.getByTestId('palette-item-popper')).toHaveAttribute('aria-pressed', 'false');
		await page.getByTestId('palette-item-popper').click();
		await expect(page.getByTestId('tool-measure')).toHaveAttribute('aria-pressed', 'false');
	});

	test('placing a label opens the Properties tab', async ({ page }) => {
		await page.getByRole('tab', { name: 'Brief' }).click();
		await placeLabel(page, 0.5, 0.5);
		await expect(page.getByRole('tab', { name: 'Properties' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});

	test('text labels survive a reload', async ({ page }) => {
		await placeLabel(page, 0.5, 0.5);
		await props(page).getByLabel('Text').fill('No-shoot behind');
		await props(page).getByLabel('Text').press('Enter');
		await page.reload();
		await expect(page.getByTestId('annotation-text')).toHaveText('No-shoot behind');
	});
});

/** Places a popper and types its position (in yards) into Properties; returns its locator. */
async function popperAt(page: Page, x: number, y: number) {
	const before = await page.getByTestId('object').count();
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.5));
	await expect(page.getByTestId('object')).toHaveCount(before + 1);
	for (const [label, v] of [
		['X', x],
		['Y', y]
	] as const) {
		await props(page).getByLabel(label).fill(String(v));
		await props(page).getByLabel(label).press('Enter');
	}
	return page.getByTestId('object').nth(before);
}

async function center(loc: ReturnType<Page['locator']>): Promise<Point> {
	const b = (await loc.boundingBox())!;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function drag(page: Page, from: Point, to: Point) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
}

/** The `translate(x y)` of an element, as numbers. */
async function translateOf(loc: ReturnType<Page['locator']>): Promise<Point> {
	const t = (await loc.getAttribute('transform'))!;
	const [x, y] = t
		.match(/translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/)!
		.slice(1)
		.map(Number);
	return { x, y };
}

const measures = (page: Page) =>
	page.locator('[data-testid="annotation"][data-annotation-type="measure"]');
const arrows = (page: Page) =>
	page.locator('[data-testid="annotation"][data-annotation-type="arrow"]');

test.describe('lines', () => {
	test('measure between two objects shows the true distance and follows a move', async ({
		page
	}) => {
		const a = await popperAt(page, 10, 5);
		const b = await popperAt(page, 10, 15);
		await page.getByTestId('tool-measure').click();
		await drag(page, await center(a), await center(b));
		await expect(measures(page)).toHaveCount(1);
		await expect(page.getByTestId('measure-label')).toHaveText('10 yd');
		await expect(props(page).getByRole('heading', { name: 'Measure line' })).toBeVisible();
		await expect(props(page).getByTestId('measure-distance')).toHaveText('10 yd');
		await expect(page.getByTestId('tool-measure')).toHaveAttribute('aria-pressed', 'false');

		await b.click();
		await props(page).getByLabel('Y').fill('20');
		await props(page).getByLabel('Y').press('Enter');
		await expect(page.getByTestId('measure-label')).toHaveText('15 yd');
	});

	test('an arrow drawn from empty ground to an object stays attached', async ({ page }) => {
		const target = await popperAt(page, 25, 15);
		await page.getByTestId('tool-arrow').click();
		await drag(page, await bayPoint(page, 0.2, 0.8), await center(target));
		await expect(arrows(page)).toHaveCount(1);

		await target.click();
		await props(page).getByLabel('X').fill('35');
		await props(page).getByLabel('X').press('Enter');
		await page.getByTestId('link-hit').click();
		const handle = await translateOf(page.getByTestId('annotation-handle-to'));
		const obj = await translateOf(target);
		expect(handle.x).toBeCloseTo(obj.x, 0);
		expect(handle.y).toBeCloseTo(obj.y, 0);
	});

	test('deleting an object detaches its line; undo reattaches it', async ({ page }) => {
		// Review Focus #5
		const a = await popperAt(page, 10, 5);
		const b = await popperAt(page, 10, 15);
		await page.getByTestId('tool-measure').click();
		await drag(page, await center(a), await center(b));
		await expect(page.getByTestId('measure-label')).toHaveText('10 yd');

		await b.click();
		await page.keyboard.press('Delete');
		await expect(page.getByTestId('object')).toHaveCount(1);
		await expect(page.getByTestId('measure-label')).toHaveText('10 yd');

		await page.getByRole('button', { name: 'Undo' }).click();
		await expect(page.getByTestId('object')).toHaveCount(2);
		await b.click();
		await props(page).getByLabel('Y').fill('25');
		await props(page).getByLabel('Y').press('Enter');
		await expect(page.getByTestId('measure-label')).toHaveText('20 yd');

		await page.getByRole('button', { name: 'Undo' }).click();
		await expect(page.getByTestId('measure-label')).toHaveText('10 yd');
		await page.getByRole('button', { name: 'Redo' }).click();
		await expect(page.getByTestId('measure-label')).toHaveText('20 yd');
	});

	test('dragging an end handle re-anchors the line', async ({ page }) => {
		const a = await popperAt(page, 10, 5);
		const b = await popperAt(page, 10, 15);
		const c = await popperAt(page, 30, 5);
		await page.getByTestId('tool-measure').click();
		await drag(page, await center(a), await center(b));
		await drag(page, await center(page.getByTestId('annotation-handle-to')), await center(c));
		await expect(page.getByTestId('measure-label')).toHaveText('20 yd');
		await c.click();
		await props(page).getByLabel('X').fill('40');
		await props(page).getByLabel('X').press('Enter');
		await expect(page.getByTestId('measure-label')).toHaveText('30 yd');
	});

	test('a tap with the measure tool makes no line', async ({ page }) => {
		await page.getByTestId('tool-measure').click();
		const p = await bayPoint(page, 0.5, 0.5);
		await page.mouse.click(p.x, p.y);
		await expect(measures(page)).toHaveCount(0);
	});

	test('lines survive a reload', async ({ page }) => {
		await page.getByTestId('tool-arrow').click();
		await drag(page, await bayPoint(page, 0.2, 0.8), await bayPoint(page, 0.6, 0.3));
		await expect(arrows(page)).toHaveCount(1);
		await page.reload();
		await expect(arrows(page)).toHaveCount(1);
	});
});

test.describe('lines and areas', () => {
	test('a line can start inside a shooting box and be clicked where it crosses one', async ({
		page
	}) => {
		await page.getByRole('combobox', { name: 'Snap' }).selectOption({ label: '1 yd' });
		await dragFromPalette(page, 'shooting-box', await bayPoint(page, 0.5, 0.5));
		for (const [label, v] of [
			['X', '25'],
			['Y', '12.5'],
			['Width', '20'],
			['Depth', '10']
		] as const) {
			await props(page).getByLabel(label).fill(v);
			await props(page).getByLabel(label).press('Enter');
		}
		await page.getByTestId('tool-measure').click();
		await drag(page, await bayPoint(page, 0.34, 0.5), await bayPoint(page, 0.9, 0.5));
		// From the point pressed inside the box (17 yd), not the box's center (25 yd).
		await expect(page.getByTestId('measure-label')).toHaveText('28 yd');

		await page.keyboard.press('Escape');
		const inside = await bayPoint(page, 0.6, 0.5);
		await page.mouse.click(inside.x, inside.y);
		await expect(props(page).getByRole('heading', { name: 'Measure line' })).toBeVisible();
	});
});

test.describe('lines on touch', () => {
	test.use({ hasTouch: true, viewport: { width: 1180, height: 820 } });

	test('pinching with the measure tool armed zooms and draws no line', async ({ page }) => {
		await page.getByTestId('tool-measure').click();
		const w0 = (await page.getByTestId('bay').boundingBox())!.width;
		const a = await bayPoint(page, 0.4, 0.5);
		const b = await bayPoint(page, 0.6, 0.5);
		const ev = (id: number, x: number, y: number) => ({
			pointerType: 'touch',
			isPrimary: id === 7,
			pointerId: id,
			bubbles: true,
			clientX: x,
			clientY: y
		});
		const stage = page.locator('svg[data-stage]');
		await stage.dispatchEvent('pointerdown', ev(7, a.x, a.y));
		await stage.dispatchEvent('pointerdown', ev(8, b.x, b.y));
		await stage.dispatchEvent('pointermove', ev(8, b.x + 60, b.y));
		await stage.dispatchEvent('pointermove', ev(8, b.x + 120, b.y));
		await stage.dispatchEvent('pointerup', ev(8, b.x + 120, b.y));
		await stage.dispatchEvent('pointerup', ev(7, a.x, a.y));
		await expect(measures(page)).toHaveCount(0);
		expect((await page.getByTestId('bay').boundingBox())!.width).toBeGreaterThan(w0 * 1.2);
	});
});
