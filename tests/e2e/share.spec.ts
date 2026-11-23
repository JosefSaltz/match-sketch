import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { createCanvas, createMatch, createPlanFromCanvas } from './helpers';

const LINK = /\/s\/[A-Za-z0-9_-]{22}$/;

async function newPlan(page: Page) {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay 4', width: '30', depth: '20', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay 4');
}

function shareDialog(page: Page, title: string) {
	return page.getByRole('dialog', { name: title });
}

async function link(page: Page, title: string): Promise<string> {
	return shareDialog(page, title).getByLabel('Link', { exact: true }).inputValue();
}

test('a stage gets a link that survives turning sharing off and on', async ({ page }) => {
	await newPlan(page);
	await page.getByRole('button', { name: 'Share' }).click();
	const dialog = shareDialog(page, 'Share stage');
	const toggle = dialog.getByRole('switch', { name: 'Anyone with the link can view' });
	await expect(toggle).not.toBeChecked();
	await expect(dialog.getByLabel('Link', { exact: true })).toHaveCount(0);

	await toggle.check();
	const first = await link(page, 'Share stage');
	expect(first).toMatch(LINK);

	await toggle.uncheck();
	await expect(dialog.getByLabel('Link', { exact: true })).toHaveCount(0);
	await toggle.check();
	expect(await link(page, 'Share stage')).toBe(first);

	// The link is saved with the plan.
	await dialog.getByRole('button', { name: 'Done' }).click();
	await page.reload();
	await page.getByRole('button', { name: 'Share' }).click();
	expect(await link(page, 'Share stage')).toBe(first);
});

test('resetting the link warns about printed QR codes and makes a new one', async ({ page }) => {
	await newPlan(page);
	await page.getByRole('button', { name: 'Share' }).click();
	const dialog = shareDialog(page, 'Share stage');
	await dialog.getByRole('switch').check();
	const first = await link(page, 'Share stage');

	await dialog.getByRole('button', { name: 'Reset link' }).click();
	const confirm = page.getByRole('dialog', { name: 'Reset link' });
	await expect(confirm).toContainText(
		'Reset the link? QR codes already printed will stop working.'
	);
	await confirm.getByRole('button', { name: 'Reset link' }).click();
	const second = await link(page, 'Share stage');
	expect(second).toMatch(LINK);
	expect(second).not.toBe(first);
});

test('offline, sharing says it takes effect once synced', async ({ page, context }) => {
	await newPlan(page);
	await context.setOffline(true);
	await page.getByRole('button', { name: 'Share' }).click();
	await expect(shareDialog(page, 'Share stage')).toContainText(
		"You're offline. Sharing changes take effect when this device syncs."
	);
	await context.setOffline(false);
});

test('a match can be shared the same way', async ({ page }) => {
	await page.goto('/');
	await createMatch(page, 'DRRC November');
	await page.getByRole('button', { name: 'Share' }).click();
	const dialog = shareDialog(page, 'Share match');
	await dialog.getByRole('switch').check();
	const first = await link(page, 'Share match');
	expect(first).toMatch(LINK);
	await dialog.getByRole('button', { name: 'Done' }).click();
	await page.reload();
	await page.getByRole('button', { name: 'Share' }).click();
	expect(await link(page, 'Share match')).toBe(first);
});
