import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { createCanvas, createPlanFromCanvas, type Point } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
});

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the stage gets the width and the page does not scroll sideways', async ({ page }) => {
		const stage = page.getByRole('application', { name: 'Stage canvas' });
		expect((await stage.boundingBox())!.width).toBeGreaterThanOrEqual(300);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
	});

	test('the Symbols drawer opens and closes', async ({ page }) => {
		const drawer = page.getByRole('complementary', { name: 'Symbols' });
		await expect(drawer).toBeHidden();
		await page.getByRole('button', { name: 'Symbols', exact: true }).click();
		await expect(drawer).toBeVisible();
		await page.getByRole('button', { name: 'Close symbols' }).click();
		await expect(drawer).toBeHidden();
	});

	test('the Inspector drawer opens and closes, and Escape closes it', async ({ page }) => {
		const drawer = page.getByRole('complementary', { name: 'Inspector' });
		await page.getByRole('button', { name: 'Inspector', exact: true }).click();
		await expect(drawer).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(drawer).toBeHidden();
		await page.getByRole('button', { name: 'Inspector', exact: true }).click();
		await page.getByRole('button', { name: 'Close inspector' }).click();
		await expect(drawer).toBeHidden();
	});

	test('arming a symbol closes the Symbols drawer', async ({ page }) => {
		await page.getByRole('button', { name: 'Symbols', exact: true }).click();
		await page.getByTestId('palette-item-wall').click();
		await expect(page.getByRole('complementary', { name: 'Symbols' })).toBeHidden();
		await expect(page.getByTestId('palette-item-wall')).toHaveAttribute('aria-pressed', 'true');
	});

	test.describe('with a finger', () => {
		test.use({ hasTouch: true });

		/** A touch swipe through the Chrome DevTools protocol, in small steps like a real finger. */
		async function swipe(page: Page, from: Point, to: Point) {
			const cdp = await page.context().newCDPSession(page);
			const at = (t: number) => [
				{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
			];
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
			for (let i = 1; i <= 30; i++) {
				await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(i / 30) });
			}
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		}

		test('swiping up the symbol list scrolls it instead of picking a symbol', async ({ page }) => {
			await page.getByRole('button', { name: 'Symbols', exact: true }).click();
			const drawer = page.getByRole('complementary', { name: 'Symbols' });
			const list = drawer.locator('.overflow-y-auto');
			const box = (await list.boundingBox())!;
			const x = box.x + box.width / 3;
			await swipe(page, { x, y: box.y + box.height * 0.8 }, { x, y: box.y + box.height * 0.3 });
			await expect.poll(() => list.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
			await expect(drawer).toBeVisible();
			await expect(page.locator('[data-testid^="palette-item-"][aria-pressed="true"]')).toHaveCount(
				0
			);
		});

		test('dragging a symbol sideways out of the drawer places it', async ({ page }) => {
			await page.getByRole('button', { name: 'Symbols', exact: true }).click();
			const popper = page.getByTestId('palette-item-popper');
			await popper.scrollIntoViewIfNeeded();
			const item = (await popper.boundingBox())!;
			const y = item.y + item.height / 2;
			await swipe(page, { x: item.x + 40, y }, { x: item.x + 300, y: y + 40 });
			await expect(page.getByRole('complementary', { name: 'Symbols' })).toBeHidden();
			await expect(page.getByTestId('object')).toHaveCount(1);
		});
	});

	test('the Menu drawer holds the secondary controls', async ({ page }) => {
		await expect(page.getByLabel('Snap')).toBeHidden();
		await page.getByRole('button', { name: 'Menu' }).click();
		await expect(page.getByLabel('Snap')).toBeVisible();
		await expect(page.getByTestId('save-status')).toBeVisible();
		await page.getByRole('button', { name: 'Close menu' }).click();
		await expect(page.getByLabel('Snap')).toBeHidden();
	});
});

test.describe('desktop', () => {
	test('hiding the Symbols panel widens the stage and the reopen button brings it back', async ({
		page
	}) => {
		const stage = page.getByRole('application', { name: 'Stage canvas' });
		const before = (await stage.boundingBox())!.width;
		await page.getByRole('button', { name: 'Hide symbols' }).click();
		await expect(page.getByRole('complementary', { name: 'Symbols' })).toBeHidden();
		await expect.poll(async () => (await stage.boundingBox())!.width).toBeGreaterThan(before + 200);
		await page.getByRole('button', { name: 'Symbols', exact: true }).click();
		await expect(page.getByRole('complementary', { name: 'Symbols' })).toBeVisible();
		await expect.poll(async () => (await stage.boundingBox())!.width).toBeCloseTo(before, -1);
	});
});
