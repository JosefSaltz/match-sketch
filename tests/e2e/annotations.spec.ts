import { test, expect, type Page } from '@playwright/test';
import { bayPoint, createCanvas, createPlanFromCanvas } from './helpers';

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
