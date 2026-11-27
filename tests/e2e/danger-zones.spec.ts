import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

const NAMES: Record<string, string> = {
	'steel-static': 'Static steel',
	popper: 'Knock-down popper',
	paper: 'Paper target',
	'shooting-position': 'Shooting position'
};

/** Drops a symbol at a point in the bay (found by search, since families start collapsed). */
async function place(page: Page, symbolId: string, fx: number, fyFromTop: number) {
	const before = await page.getByTestId('object').count();
	const search = page.getByPlaceholder('Search symbols');
	await search.fill(NAMES[symbolId]);
	await dragFromPalette(page, symbolId, await bayPoint(page, fx, fyFromTop));
	await expect(page.getByTestId('object')).toHaveCount(before + 1);
	// Keep Escape for the editor, not the search field.
	await search.fill('');
	await search.evaluate((el: HTMLElement) => el.blur());
}

async function setLayer(page: Page, label: string, on: boolean) {
	const toggle = page.getByRole('button', { name: 'Danger zones', exact: true });
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
	const box = page
		.getByRole('group', { name: 'Danger zones' })
		.getByRole('checkbox', { name: label });
	await box.setChecked(on);
	await toggle.click(); // close the panel so Escape and clicks reach the canvas
	await expect(page.getByRole('group', { name: 'Danger zones' })).toHaveCount(0);
}

const legend = (page: Page) => page.getByTestId('danger-legend');
const splash = (page: Page) => page.getByTestId('danger-splash');
const fan = (page: Page) => page.getByTestId('danger-fan');

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Danger bay', width: '40', depth: '50', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Danger bay');
});

test('no zones until a toggle is on', async ({ page }) => {
	await place(page, 'steel-static', 0.5, 0.3);
	await expect(splash(page)).toHaveCount(0);
	await expect(legend(page)).toBeHidden();
});

test('AR splash draws on every steel target and not on paper', async ({ page }) => {
	await place(page, 'steel-static', 0.3, 0.3);
	await place(page, 'popper', 0.6, 0.3);
	await place(page, 'paper', 0.5, 0.5);
	await setLayer(page, 'AR 385-63 splash', true);
	await expect(splash(page)).toHaveCount(2);
	await expect(legend(page)).toContainText('¶2-17a(2)');
	await expect(legend(page)).toContainText('Berms and baffles are not modeled.');
	await setLayer(page, 'AR 385-63 splash', false);
	await expect(splash(page)).toHaveCount(0);
	await expect(legend(page)).toBeHidden();
});

test('9mm fan needs a shooting position', async ({ page }) => {
	// Review Focus 5
	await place(page, 'steel-static', 0.5, 0.3);
	await setLayer(page, '9mm Luger', true);
	await expect(fan(page)).toHaveCount(0);
	await expect(legend(page)).toContainText(
		'Add a shooting position or shooting box to see the ricochet fan.'
	);
	await place(page, 'shooting-position', 0.5, 0.9);
	await expect(fan(page)).toHaveCount(1);
	expect(await page.getByTestId('danger-tag').count()).toBeGreaterThanOrEqual(2);
	expect(await page.getByTestId('danger-exit').count()).toBeGreaterThanOrEqual(2);
	await expect(
		page.getByTestId('danger-tag').filter({ hasText: 'past bay' }).first()
	).toBeVisible();
	await expect(legend(page)).toContainText('1 in 1,000,000');
	await expect(legend(page)).toContainText('AR 385-63 ¶3-1b');
	await expect(legend(page)).toContainText('Table 5-4');
	await expect(legend(page)).toContainText('Thin lines: dispersion area');
	await expect(legend(page)).toContainText('computed by Match Sketch from this plan');
});

test('edge tags show one unit, yards or meters as chosen', async ({ page }) => {
	await place(page, 'steel-static', 0.5, 0.3);
	await place(page, 'shooting-position', 0.5, 0.9);
	await setLayer(page, '9mm Luger', true);
	const tags = page.getByTestId('danger-tag');
	await expect(tags.filter({ hasText: 'X 1,969 yd · ' }).first()).toBeVisible();
	await expect(tags.filter({ hasText: '(' })).toHaveCount(0);
	const toggle = page.getByRole('button', { name: 'Danger zones', exact: true });
	await toggle.click();
	await page.getByRole('group', { name: 'Danger zones' }).getByLabel('Distances').selectOption('m');
	await toggle.click();
	await expect(tags.filter({ hasText: 'X 1.8 km · ' }).first()).toBeVisible();
	await expect(tags.filter({ hasText: ' yd' })).toHaveCount(0);
	// Remembered on this device.
	await page.reload();
	await page.getByTestId('bay').waitFor();
	await setLayer(page, '9mm Luger', true);
	await expect(tags.filter({ hasText: 'X 1.8 km · ' }).first()).toBeVisible();
});

test('selecting a target shows only its zones', async ({ page }) => {
	await place(page, 'steel-static', 0.3, 0.3);
	await place(page, 'steel-static', 0.7, 0.3);
	await place(page, 'shooting-position', 0.5, 0.9);
	await setLayer(page, 'AR 385-63 splash', true);
	await setLayer(page, '9mm Luger', true);
	await expect(splash(page)).toHaveCount(2);
	await expect(fan(page)).toHaveCount(2);
	await page.getByTestId('object').first().click();
	await expect(splash(page)).toHaveCount(1);
	await expect(fan(page)).toHaveCount(1);
	await page.keyboard.press('Escape');
	await expect(splash(page)).toHaveCount(2);
	await expect(fan(page)).toHaveCount(2);
});

test('zones follow a dragged target', async ({ page }) => {
	// Review Focus 1
	await place(page, 'steel-static', 0.5, 0.3);
	await setLayer(page, 'AR 385-63 splash', true);
	const path: Locator = splash(page).first().locator('path.line').first();
	const original = (await path.getAttribute('d'))!;
	const target = page.getByTestId('object').first();
	const b = (await target.boundingBox())!;
	const to = await bayPoint(page, 0.7, 0.5);
	await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await expect(path).not.toHaveAttribute('d', original); // still holding the target
	await page.mouse.up();
	await expect(path).not.toHaveAttribute('d', original);
});

test('toggles are not saved with the plan', async ({ page }) => {
	await place(page, 'steel-static', 0.5, 0.3);
	await setLayer(page, 'AR 385-63 splash', true);
	await expect(splash(page)).toHaveCount(1);
	await page.reload();
	await expect(page.getByTestId('bay')).toBeVisible();
	await expect(page.getByTestId('object')).toHaveCount(1);
	await expect(page.getByTestId('danger-zones').locator('> *')).toHaveCount(0);
});

test('Escape closes the Danger zones panel and keeps focus on its button', async ({ page }) => {
	const toggle = page.getByRole('button', { name: 'Danger zones', exact: true });
	await toggle.click();
	const panel = page.getByRole('group', { name: 'Danger zones' });
	await panel.getByRole('checkbox', { name: 'AR 385-63 splash' }).focus();
	await page.keyboard.press('Escape');
	await expect(panel).toHaveCount(0);
	await expect(toggle).toBeFocused();
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('nothing is drawn without steel targets', async ({ page }) => {
	await place(page, 'paper', 0.5, 0.3);
	await place(page, 'shooting-position', 0.5, 0.9);
	for (const label of ['AR 385-63 splash', 'Pistol NZ splash', '9mm Luger', '5.56 NATO'])
		await setLayer(page, label, true);
	await expect(splash(page)).toHaveCount(0);
	await expect(fan(page)).toHaveCount(0);
	await expect(legend(page)).toContainText('No steel targets on the plan.');
});

test('the legend collapses and expands', async ({ page }) => {
	await place(page, 'steel-static', 0.5, 0.3);
	await setLayer(page, 'AR 385-63 splash', true);
	const region = page.getByRole('region', { name: 'Danger zones legend' });
	const button = region.getByRole('button', { name: 'Legend' });
	await expect(button).toHaveAttribute('aria-expanded', 'true');
	await expect(region).toContainText('¶2-17a(2)');
	await button.click();
	await expect(button).toHaveAttribute('aria-expanded', 'false');
	await expect(region.getByText('¶2-17a(2)', { exact: false })).toBeHidden();
	await button.click();
	await expect(region.getByText('¶2-17a(2)', { exact: false })).toBeVisible();
});
