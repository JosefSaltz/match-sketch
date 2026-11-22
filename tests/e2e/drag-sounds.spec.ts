import { test, expect, type Page } from '@playwright/test';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

/** Replaces Web Audio with a stub that counts clicks (each oscillator start). */
async function countClicks(page: Page) {
	await page.addInitScript(() => {
		const w = window as unknown as { __clicks: number; AudioContext: unknown };
		w.__clicks = 0;
		const param = () => ({
			value: 0,
			setValueAtTime() {
				return this;
			},
			linearRampToValueAtTime() {
				return this;
			},
			exponentialRampToValueAtTime() {
				return this;
			}
		});
		const node = () => ({ connect: (n: unknown) => n, disconnect() {} });
		w.AudioContext = class {
			currentTime = 0;
			state = 'running';
			destination = node();
			resume() {
				return Promise.resolve();
			}
			createOscillator() {
				return {
					...node(),
					type: 'sine',
					frequency: param(),
					start: () => w.__clicks++,
					stop() {}
				};
			}
			createGain() {
				return { ...node(), gain: param() };
			}
		};
	});
}

const clicks = (page: Page) =>
	page.evaluate(() => (window as unknown as { __clicks: number }).__clicks);

/** Drags the popper sideways in slow steps, so the click rate limit doesn't drop any. */
async function dragAcross(page: Page) {
	const o = (await page.getByTestId('object').boundingBox())!;
	const [x, y] = [o.x + o.width / 2, o.y + o.height / 2];
	await page.mouse.move(x, y);
	await page.mouse.down();
	for (let i = 1; i <= 8; i++) {
		await page.mouse.move(x + i * 12, y);
		await page.waitForTimeout(60);
	}
	await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
	await countClicks(page);
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	await page.getByRole('combobox', { name: 'Snap' }).selectOption({ label: '1 yd' });
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.3, 0.5));
});

test('dragging across grid lines clicks', async ({ page }) => {
	const before = await clicks(page);
	await dragAcross(page);
	expect((await clicks(page)) - before).toBeGreaterThanOrEqual(3);
});

test('the Sounds button silences the clicks and is remembered', async ({ page }) => {
	const sounds = page.getByRole('button', { name: 'Sounds' });
	await expect(sounds).toHaveAttribute('aria-pressed', 'true');
	await sounds.click();
	await expect(sounds).toHaveAttribute('aria-pressed', 'false');
	const before = await clicks(page);
	await dragAcross(page);
	expect(await clicks(page)).toBe(before);
	await page.reload();
	await expect(page.getByRole('button', { name: 'Sounds' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
});
