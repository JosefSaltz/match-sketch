import { emptyPlanDocument } from '../../src/lib/model/plan';
import { expect, test } from './fixtures';
import { createCanvas, createPlanFromCanvas } from './helpers';
import { signIn } from './support/accounts';
import { accountId, eventually, otherDevice, pushed, synced, withSql } from './support/devices';

const unassigned = (page: import('@playwright/test').Page) =>
	page.locator('section[aria-labelledby="plans-heading"]');

async function namedPlan(page: import('@playwright/test').Page, name: string) {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay 4', width: '30', depth: '20', unit: 'Yards' });
	const id = await createPlanFromCanvas(page, 'Bay 4');
	await setStageName(page, name);
	return id;
}

async function setStageName(page: import('@playwright/test').Page, name: string) {
	await page.getByRole('tab', { name: 'Brief' }).click();
	const field = page.getByRole('tabpanel', { name: 'Brief' }).getByLabel('Stage name');
	await field.fill(name);
	await field.blur();
}

test('a new plan shows as pending, then synced', async ({ page }) => {
	await namedPlan(page, 'Bay drill');
	await pushed(page);
});

test('a plan reaches another device, with its edits and its deletion', async ({
	page,
	browser,
	baseURL,
	account
}) => {
	await namedPlan(page, 'Bay drill');
	await pushed(page);
	const other = await otherDevice(browser, baseURL!, account);
	const onOther = (name: string) => unassigned(other.page).getByRole('heading', { name });
	await eventually(other.page, onOther('Bay drill'), (n) => n === 1);

	await setStageName(page, 'Bay drill, revised');
	await pushed(page);
	await eventually(other.page, onOther('Bay drill, revised'), (n) => n === 1);

	await page.goto('/');
	await unassigned(page).getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await pushed(page);
	await eventually(other.page, onOther('Bay drill, revised'), (n) => n === 0);
	await other.context.close();
});

test("the cloud button pulls another device's plan without waiting for the next round", async ({
	page,
	browser,
	baseURL,
	account
}) => {
	await page.goto('/');
	await synced(page);
	const other = await otherDevice(browser, baseURL!, account);
	await namedPlan(other.page, 'Bay drill');
	await pushed(other.page);
	await other.context.close();

	// Well inside the 30 s interval, so only the click can have fetched it.
	await page.getByRole('button', { name: /Synced\. Sync now/ }).click();
	await expect(unassigned(page).getByRole('heading', { name: 'Bay drill' })).toBeVisible({
		timeout: 5_000
	});
});

test.describe('with requests routed', () => {
	// page.route can't see requests that a service worker handles.
	test.use({ serviceWorkers: 'block' });

	test('the first sign-in on a device uploads its plans from before accounts', async ({
		page,
		browser,
		baseURL,
		account
	}) => {
		// Keep the plan unsynced (version 0), like one made before accounts existed.
		await page.route('**/api/sync/**', (route) => route.abort());
		await namedPlan(page, 'From before accounts');
		await page.goto('/');
		// Make the device look like it has never been signed in: no owner on record.
		await page.evaluate(
			() =>
				new Promise<void>((resolve, reject) => {
					const open = indexedDB.open('match-sketch');
					open.onsuccess = () => {
						const tx = open.result.transaction('settings', 'readwrite');
						tx.objectStore('settings').delete('sync-owner');
						tx.oncomplete = () => (open.result.close(), resolve());
						tx.onerror = () => reject(tx.error ?? new Error('transaction failed'));
					};
					open.onerror = () => reject(open.error ?? new Error('open failed'));
				})
		);
		await page.unroute('**/api/sync/**');
		await page.reload();
		await expect(
			page.getByText('Added 1 plan and 1 canvas from this device to your account.')
		).toBeVisible();
		await synced(page);
		const other = await otherDevice(browser, baseURL!, account);
		await expect(unassigned(other.page).getByText('From before accounts')).toBeVisible({
			timeout: 15_000
		});
		await other.context.close();
	});
});

test('a plan saved by a newer app asks for a reload', async ({ page, account }) => {
	await page.goto('/');
	await synced(page);
	const owner = await accountId(account.email);
	await withSql(
		(sql) => sql`insert into public.plans
			(id, owner_id, version, updated_at, width_ft, depth_ft, unit, schema_version, document)
			values (${crypto.randomUUID()}, ${owner}, 1, now(), 90, 60, 'yd', 2,
				${sql.json({ ...emptyPlanDocument(), future: true })})`
	);
	await page.reload();
	await expect(
		page.getByText('A newer version of Match Sketch saved some of your plans. Reload to update.')
	).toBeVisible({ timeout: 15_000 });
	await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
});

test('a plan link opened on a new device shows the plan once it arrives', async ({
	page,
	browser,
	baseURL,
	account
}) => {
	const planId = await namedPlan(page, 'Linked');
	await pushed(page);
	const context = await browser.newContext({ baseURL, reducedMotion: 'reduce' });
	const fresh = await context.newPage();
	// Signing in from the link lands straight on the plan, before the first pull.
	await fresh.goto(`/sign-in?next=${encodeURIComponent(`/plans/${planId}`)}`);
	await signIn(fresh, account);
	await expect(fresh.getByRole('tab', { name: 'Brief' })).toBeVisible({ timeout: 15_000 });
	await context.close();
});
