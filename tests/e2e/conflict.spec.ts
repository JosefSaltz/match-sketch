import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { createCanvas, createPlanFromCanvas } from './helpers';
import { eventually, otherDevice, pushed, synced } from './support/devices';

const briefField = (page: Page) =>
	page.getByRole('tabpanel', { name: 'Brief' }).getByLabel('Stage name');

async function setStageName(page: Page, name: string) {
	await page.getByRole('tab', { name: 'Brief' }).click();
	await briefField(page).fill(name);
	await briefField(page).blur();
}

test('a plan edited on two devices at once keeps both versions (Review Focus #1)', async ({
	page,
	context,
	browser,
	baseURL,
	account
}) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay 4', width: '30', depth: '20', unit: 'Yards' });
	const planId = await createPlanFromCanvas(page, 'Bay 4');
	await setStageName(page, 'Bay drill');
	await pushed(page);

	// Device B has the plan too.
	const b = await otherDevice(browser, baseURL!, account);
	const onB = (name: RegExp | string) =>
		b.page.locator('section[aria-labelledby="plans-heading"]').getByRole('heading', { name });
	await eventually(b.page, onB('Bay drill'), (n) => n === 1);

	// A edits offline; B edits online and syncs first.
	await context.setOffline(true);
	await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'Offline');
	await setStageName(page, 'Bay drill A');
	await b.page.goto(`/plans/${planId}`);
	await setStageName(b.page, 'Bay drill B');
	await pushed(b.page);

	// A comes back: the server's version wins the plan, A's is kept as a copy.
	await context.setOffline(false);
	await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'Conflict', {
		timeout: 15_000
	});
	await page.getByRole('tab', { name: 'Brief' }).click();
	await expect(briefField(page)).toHaveValue('Bay drill B');

	await page.goto('/');
	const plansOnA = page.locator('section[aria-labelledby="plans-heading"]');
	await expect(plansOnA.getByRole('heading', { name: 'Bay drill B' })).toBeVisible();
	const copyName = /^Bay drill A \(conflicted copy, [A-Z][a-z]{2} \d{1,2} \d{1,2}:\d{2} [AP]M\)$/;
	await expect(plansOnA.getByRole('heading', { name: copyName })).toBeVisible();

	await page.getByTestId('sync-status').click();
	const dialog = page.getByRole('dialog', { name: 'Conflicted copies' });
	await expect(dialog.getByRole('link', { name: copyName })).toBeVisible();
	await dialog.getByRole('button', { name: 'Dismiss' }).click();
	await synced(page);

	// B receives the copy too.
	await b.page.goto('/');
	await eventually(b.page, onB(copyName), (n) => n === 1);
	await b.context.close();
});
