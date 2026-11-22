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
