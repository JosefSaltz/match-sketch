import type { Browser, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
	bayPoint,
	createCanvas,
	createMatch,
	createPlanFromCanvas,
	dragFromPalette
} from './helpers';
import { pushed, synced } from './support/devices';

const panel = (page: Page, name: string) => page.getByRole('tabpanel', { name });

async function fillBrief(page: Page, fields: Record<string, string>) {
	await page.getByRole('tab', { name: 'Brief' }).click();
	for (const [label, value] of Object.entries(fields)) {
		const field = panel(page, 'Brief').getByLabel(label, { exact: true });
		await field.fill(value);
		await field.blur();
	}
}

/** Turns sharing on (or off) and returns the link. */
async function share(page: Page, title: string, on = true): Promise<string> {
	await page.getByRole('button', { name: 'Share' }).click();
	const dialog = page.getByRole('dialog', { name: title });
	const toggle = dialog.getByRole('switch');
	if (on) await toggle.check();
	else await toggle.uncheck();
	const link = on ? await dialog.getByLabel('Link', { exact: true }).inputValue() : '';
	await dialog.getByRole('button', { name: 'Done' }).click();
	return link;
}

/** A browser with no account, as a shooter scanning the QR code. */
async function stranger(browser: Browser, baseURL: string) {
	const context = await browser.newContext({ baseURL, reducedMotion: 'reduce' });
	return { context, page: await context.newPage() };
}

async function sharedStage(page: Page) {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay 4', width: '30', depth: '20', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay 4');
	await fillBrief(page, {
		'Stage name': 'Bunker Down',
		'Start position': 'Standing in box A',
		'Stage procedure': 'Start in box A\nEngage the popper'
	});
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.3));
	await page.getByRole('tab', { name: 'Walkthrough' }).click();
	await panel(page, 'Walkthrough').getByRole('button', { name: 'Engage the popper' }).click();
	await panel(page, 'Walkthrough')
		.getByRole('group', { name: 'Mark the selected objects as' })
		.getByRole('button', { name: 'Shoot' })
		.click();
	const link = await share(page, 'Share stage');
	await pushed(page);
	return link;
}

test('anyone with the link sees the stage and its walkthrough, until sharing is off', async ({
	page,
	browser,
	baseURL
}) => {
	const link = await sharedStage(page);
	const viewer = await stranger(browser, baseURL!);
	await viewer.page.goto(link);
	const v = viewer.page;
	await expect(v.getByRole('heading', { level: 1 })).toHaveText('Bunker Down');
	await expect(v.getByRole('img', { name: 'Diagram of Bunker Down' })).toBeVisible();
	await expect(v.getByText('Standing in box A')).toBeVisible();
	await expect(v.getByRole('region', { name: 'Stage procedure' }).getByRole('listitem')).toHaveText(
		['Start in box A', 'Engage the popper']
	);
	await expect(v.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');

	await v.getByRole('button', { name: 'Walkthrough' }).click();
	await expect(v.getByTestId('step-count')).toHaveText('Step 1 of 2');
	await v.getByRole('button', { name: 'Next' }).click();
	await expect(v.getByRole('list', { name: 'Legend' })).toHaveText('Shoot');
	await expect(v.locator('[data-highlight]')).toHaveAttribute('data-meaning', 'shoot');

	await share(page, 'Share stage', false);
	await pushed(page);
	await v.reload();
	await expect(v.getByRole('heading', { name: "This link isn't shared" })).toBeVisible();
	await expect(v.getByText('Ask the person who shared it for a new link.')).toBeVisible();
	await viewer.context.close();
});

test('a shared match lists its stages in order and opens each one', async ({
	page,
	browser,
	baseURL
}) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay 4', width: '30', depth: '20', unit: 'Yards' });
	const matchId = await createMatch(page, 'DRRC November', '2026-11-29');
	for (const name of ['Bunker Down', 'Rooftop']) {
		await page.goto(`/matches/${matchId}`);
		await page.getByRole('link', { name: 'New stage' }).click();
		await page.getByLabel('Use a saved canvas').check();
		await page.getByRole('button', { name: 'Create plan' }).click();
		await expect(page.getByTestId('bay')).toBeVisible();
		await fillBrief(page, { 'Stage name': name });
	}
	await page.goto(`/matches/${matchId}`);
	const link = await share(page, 'Share match');
	// The match screen has no sync indicator; home syncs on load and shows it.
	await page.goto('/');
	await synced(page);

	const viewer = await stranger(browser, baseURL!);
	const v = viewer.page;
	await v.goto(link);
	await expect(v.getByRole('heading', { level: 1 })).toHaveText('DRRC November');
	const stages = v.getByRole('region', { name: 'Stages' }).getByRole('link');
	await expect(stages).toHaveText(['Stage 1 — Bunker Down', 'Stage 2 — Rooftop']);
	await stages.nth(1).click();
	await expect(v.getByRole('heading', { level: 1 })).toHaveText('Stage 2 — Rooftop');
	await expect(v.getByRole('navigation', { name: 'Stages' })).toContainText('Stage 2 of 2');
	await v.getByRole('link', { name: 'Previous stage' }).click();
	await expect(v.getByRole('heading', { level: 1 })).toHaveText('Stage 1 — Bunker Down');

	await v.goto(`${link}?stage=${crypto.randomUUID()}`);
	await expect(v.getByRole('heading', { name: "This link isn't shared" })).toBeVisible();
	await viewer.context.close();
});

test('the viewer fits a phone without sideways scrolling', async ({ page, browser, baseURL }) => {
	const link = await sharedStage(page);
	const viewer = await stranger(browser, baseURL!);
	const v = viewer.page;
	await v.setViewportSize({ width: 390, height: 844 });
	await v.goto(link);
	await expect(v.getByRole('img', { name: 'Diagram of Bunker Down' })).toBeVisible();
	const overflow = await v.evaluate(() => document.documentElement.scrollWidth - innerWidth);
	expect(overflow).toBeLessThanOrEqual(0);
	await v.getByRole('button', { name: 'Walkthrough' }).click();
	expect(
		await v.evaluate(() => document.documentElement.scrollWidth - innerWidth)
	).toBeLessThanOrEqual(0);
	await viewer.context.close();
});

test('a viewer can print the shared stage, with its QR code', async ({
	page,
	browser,
	baseURL
}) => {
	const link = await sharedStage(page);
	const viewer = await stranger(browser, baseURL!);
	const v = viewer.page;
	await v.goto(link);
	await v.getByRole('link', { name: 'Print' }).click();
	await expect(v.getByTestId('print-page').first()).toContainText('BUNKER DOWN');
	await expect(v.getByTestId('share-qr')).toHaveCount(1);
	await v.getByRole('link', { name: 'Back to stage' }).click();
	await expect(v.getByRole('heading', { level: 1 })).toHaveText('Bunker Down');
	await viewer.context.close();
});
