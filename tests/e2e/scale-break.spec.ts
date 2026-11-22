import { test, expect, type Page } from '@playwright/test';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

const props = (page: Page) => page.getByRole('tabpanel', { name: 'Properties' });

async function setBreak(page: Page, value: string) {
	await page.keyboard.press('Escape'); // nothing selected: the Drawing settings show
	const field = props(page).getByLabel('Not to scale beyond');
	await field.fill(value);
	await field.press('Enter');
}

async function popperAt(page: Page, x: number, y: number) {
	const before = await page.getByTestId('object').count();
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.95));
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

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Long bay', width: '40', depth: '300', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Long bay');
	await page.getByRole('combobox', { name: 'Snap' }).selectOption({ label: '1 yd' });
});

test('setting a depth draws the far zone as a labeled strip', async ({ page }) => {
	await expect(page.getByTestId('scale-break')).toHaveCount(0);
	await setBreak(page, '30');
	await expect(page.getByTestId('scale-break')).toBeVisible();
	await expect(page.getByTestId('scale-break-label')).toHaveText('Not to scale beyond 30 yd');
	await expect(page.getByTestId('scale-bar')).toContainText('outside the strip');
});

test('objects in the strip show their true distance', async ({ page }) => {
	await setBreak(page, '30');
	const p = await popperAt(page, 20, 150);
	await expect(p.getByTestId('object-distance')).toHaveText('150 yd');
	await props(page).getByLabel('Y').fill('10');
	await props(page).getByLabel('Y').press('Enter');
	await expect(p.getByTestId('object-distance')).toHaveCount(0);
});

test('dragging across the break edge lands at the true position', async ({ page }) => {
	// Review Focus #1
	await setBreak(page, '30');
	const p = await popperAt(page, 20, 150);
	const drag = async (fy: number) => {
		const b = (await p.boundingBox())!;
		const to = await bayPoint(page, 0.5, fy);
		await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
		await page.mouse.down();
		await page.mouse.move(to.x, to.y, { steps: 8 });
		await page.mouse.up();
	};
	await drag(0.9); // near the shooter: true scale
	const near = Number(await props(page).getByLabel('Y').inputValue());
	expect(near).toBeLessThan(30);
	await expect(p.getByTestId('object-distance')).toHaveCount(0);
	await drag(0.1); // deep in the strip
	const far = Number(await props(page).getByLabel('Y').inputValue());
	expect(far).toBeGreaterThan(30);
	await expect(p.getByTestId('object-distance')).toHaveText(`${far} yd`);
});

test('a measure line across the break shows the true distance', async ({ page }) => {
	// Review Focus #3
	await setBreak(page, '30');
	const a = await popperAt(page, 20, 10);
	const b = await popperAt(page, 20, 150);
	await page.getByTestId('tool-measure').click();
	const pa = (await a.boundingBox())!;
	const pb = (await b.boundingBox())!;
	await page.mouse.move(pa.x + pa.width / 2, pa.y + pa.height / 2);
	await page.mouse.down();
	await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 8 });
	await page.mouse.up();
	await expect(page.getByTestId('measure-label')).toHaveText('140 yd');
});

test('zoom and fit work with the strip on', async ({ page }) => {
	// Review Focus #2
	await setBreak(page, '30');
	const stage = (await page.locator('svg[data-stage]').boundingBox())!;
	await page.getByRole('button', { name: 'Zoom in' }).click();
	await page.getByRole('button', { name: 'Zoom out' }).click();
	await expect(page.getByTestId('bay')).toBeVisible();
	await page.getByRole('button', { name: 'Fit' }).click();
	const bay = (await page.getByTestId('bay').boundingBox())!;
	expect(bay.height).toBeCloseTo(stage.height - 96, -1);
});

test('undo and redo the break, and it survives a reload', async ({ page }) => {
	// Review Focus #4 and #5
	await setBreak(page, '30');
	await page.reload();
	await expect(page.getByTestId('scale-break')).toBeVisible();
	await setBreak(page, '');
	await expect(page.getByTestId('scale-break')).toHaveCount(0);
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByTestId('scale-break')).toBeVisible();
	await page.getByRole('button', { name: 'Redo' }).click();
	await expect(page.getByTestId('scale-break')).toHaveCount(0);
});

test('an impossible depth puts the stored value back', async ({ page }) => {
	await setBreak(page, '30');
	await setBreak(page, '400');
	await expect(props(page).getByLabel('Not to scale beyond')).toHaveValue('30');
	await expect(page.getByTestId('scale-break-label')).toHaveText('Not to scale beyond 30 yd');
});

/** The `translate(x y)` of an element, as numbers. */
async function translateOf(loc: ReturnType<Page['locator']>): Promise<{ x: number; y: number }> {
	const t = (await loc.getAttribute('transform'))!;
	const [x, y] = t
		.match(/translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/)!
		.slice(1)
		.map(Number);
	return { x, y };
}

test.describe('handles and drags inside the strip stay under the pointer', () => {
	test.beforeEach(async ({ page }) => {
		await page.getByRole('combobox', { name: 'Snap' }).selectOption({ label: 'Off' });
		await setBreak(page, '30');
	});

	test('an object grabbed off its point and dragged across the edge lands under the pointer', async ({
		page
	}) => {
		// Final review (Critical): grab near the glyph top, then cross the edge both ways.
		const p = await popperAt(page, 20, 150);
		/** True depth (yd) under a page y: bay bottom is 0; 30 yd and beyond is the squeezed strip. */
		const trueYdAt = async (pageY: number) => {
			const bay = (await page.getByTestId('bay').boundingBox())!;
			const scale = bay.width / 120; // px per ft
			const drawn = (bay.y + bay.height - pageY) / scale;
			const ft = drawn <= 90 ? drawn : 90 + ((drawn - 90) * 810) / 75;
			return ft / 3;
		};
		for (const fy of [0.85, 0.12]) {
			const b = (await p.locator('svg').first().boundingBox())!;
			const press = { x: b.x + b.width / 2, y: b.y + 4 };
			const stage = (await page.locator('svg[data-stage]').boundingBox())!;
			const pos = await translateOf(p);
			const grabY = stage.y + pos.y - press.y; // the object's point is this far below the press
			const to = await bayPoint(page, 0.5, fy);
			await page.mouse.move(press.x, press.y);
			await page.mouse.down();
			await page.mouse.move(to.x, to.y, { steps: 10 });
			await page.mouse.up();
			const expected = await trueYdAt(to.y + grabY);
			const actual = Number(await props(page).getByLabel('Y').inputValue());
			expect(Math.abs(actual - expected)).toBeLessThan(fy < 0.5 ? 6 : 1);
		}
	});

	test('the rotate handle turns a box in the strip to the pointer’s angle', async ({ page }) => {
		// Final review (Important): rotation is measured on screen.
		await dragFromPalette(page, 'shooting-box', await bayPoint(page, 0.5, 0.95));
		for (const [label, v] of [
			['X', '20'],
			['Y', '150']
		] as const) {
			await props(page).getByLabel(label).fill(v);
			await props(page).getByLabel(label).press('Enter');
		}
		const box = page.locator('[data-symbol-id="shooting-box"]');
		const stage = (await page.locator('svg[data-stage]').boundingBox())!;
		const c = await translateOf(box);
		const center = { x: stage.x + c.x, y: stage.y + c.y };
		const h = (await page.getByTestId('handle-rotate').boundingBox())!;
		await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
		await page.mouse.down();
		// 45° clockwise from downrange (up on screen), 80 px out.
		await page.mouse.move(center.x + 57, center.y - 57, { steps: 8 });
		await page.mouse.up();
		await expect(props(page).getByLabel('Rotation (°)')).toHaveValue('45');
	});

	test('a resize handle in the strip follows the pointer', async ({ page }) => {
		// Final review (Important): resize works in the drawn frame.
		await dragFromPalette(page, 'shooting-box', await bayPoint(page, 0.5, 0.95));
		for (const [label, v] of [
			['X', '20'],
			['Y', '150'],
			['Width', '10'],
			['Depth', '5']
		] as const) {
			await props(page).getByLabel(label).fill(v);
			await props(page).getByLabel(label).press('Enter');
		}
		const h = (await page.getByTestId('handle-ne').boundingBox())!;
		const start = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
		await page.mouse.move(start.x, start.y);
		await page.mouse.down();
		await page.mouse.move(start.x + 10, start.y - 15, { steps: 6 });
		await page.mouse.up();
		const after = (await page.getByTestId('handle-ne').boundingBox())!;
		expect(after.x + after.width / 2).toBeCloseTo(start.x + 10, -0.5);
		expect(after.y + after.height / 2).toBeCloseTo(start.y - 15, -0.5);
	});
});
