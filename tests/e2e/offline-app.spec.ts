import type { Response } from '@playwright/test';
import { expect, test } from './fixtures';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';
import { eventually, otherDevice, pushed, synced } from './support/devices';

test('a signed-in device opens and edits offline, then syncs (Review Focus #5)', async ({
	page,
	context,
	browser,
	baseURL,
	account
}) => {
	test.setTimeout(120_000);
	await page.goto('/');
	await createCanvas(page, { name: 'Bay 4', width: '30', depth: '20', unit: 'Yards' });
	const planId = await createPlanFromCanvas(page, 'Bay 4');
	// Catch the push on the editor: reloading the home page first syncs at once and can skip
	// the pending state.
	await pushed(page);
	await page.goto('/');
	// The service worker precaches the whole app (about 1.5 MB) before it takes control; under
	// a parallel test run that can take a while.
	await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
		timeout: 60_000
	});

	const documents: Response[] = [];
	page.on('response', (r) => {
		if (r.request().resourceType() === 'document') documents.push(r);
	});
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Match Sketch' })).toBeVisible();
	expect(documents.at(-1)?.fromServiceWorker()).toBe(true);
	await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'Offline');
	const plans = page.locator('section[aria-labelledby="plans-heading"]').getByRole('listitem');
	await expect(plans).toHaveCount(1);

	await plans.getByRole('link', { name: 'Open' }).click();
	await expect(page).toHaveURL(`/plans/${planId}`);
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.5));
	await expect(page.getByTestId('object')).toHaveCount(1);
	await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'Offline');

	await context.setOffline(false);
	await synced(page);
	const other = await otherDevice(browser, baseURL!, account);
	await synced(other.page);
	await other.page.goto(`/plans/${planId}`);
	await eventually(other.page, other.page.getByTestId('object'), (n) => n === 1);
	await other.context.close();
});
