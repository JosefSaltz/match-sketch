import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

// The draft endpoint is mocked; page.route can't see requests a service worker handles.
test.use({ serviceWorkers: 'block' });

const PROCEDURE = 'On start signal, engage two poppers from SA-1, then the steel from SA-2.';
const draft = {
	status: 'ok',
	objects: [
		{ symbolId: 'shooting-box', x: 20, y: 10, rotation: 0, label: 'SA-1', widthFt: 6, depthFt: 6 },
		{ symbolId: 'popper', x: 20, y: 60, rotation: 0, count: 2 },
		{ symbolId: 'steel-static', x: 50, y: 70, rotation: 0 }
	],
	unrepresentable: ['the sequence bucket'],
	dropped: [{ what: 'unicorn at (5, 5)', reason: 'unknown symbol "unicorn"' }]
};

async function mockDrafts(page: Page, status: number, body: unknown) {
	const calls: unknown[] = [];
	await page.route('**/api/drafts', async (route) => {
		calls.push(route.request().postDataJSON());
		await route.fulfill({ status, json: body });
	});
	return calls;
}

async function newPlan(page: Page, procedure = PROCEDURE) {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay 4', width: '30', depth: '30', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay 4');
	await page.getByRole('tab', { name: 'Brief' }).click();
	const field = page.getByRole('tabpanel', { name: 'Brief' }).getByLabel('Stage procedure');
	await field.fill(procedure);
	await field.blur();
}

const objects = (page: Page) => page.getByTestId('object');
const measures = (page: Page) =>
	page.locator('[data-testid="annotation"][data-annotation-type="measure"]');

async function drafted(page: Page) {
	await page.getByRole('button', { name: 'Draft from text' }).click();
	const dialog = page.getByRole('dialog', { name: 'Draft from text' });
	await expect(dialog.getByLabel('Description')).toHaveValue(PROCEDURE);
	await dialog.getByRole('button', { name: 'Draft layout' }).click();
	return dialog;
}

test('a draft lands on an empty bay as one undoable step', async ({ page }) => {
	const calls = await mockDrafts(page, 200, draft);
	await newPlan(page);
	const dialog = await drafted(page);
	await expect(dialog.getByText('Not drawn: the sequence bucket')).toBeVisible();
	await expect(
		dialog.getByText('Dropped: unicorn at (5, 5) — unknown symbol "unicorn"')
	).toBeVisible();
	await dialog.getByRole('button', { name: 'Apply draft' }).click();
	await expect(objects(page)).toHaveCount(3);
	expect(calls[0]).toMatchObject({ description: PROCEDURE, canvas: { widthFt: 90, depthFt: 90 } });
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(objects(page)).toHaveCount(0);
});

test('a draft over existing objects asks first, and undo brings them back (Review Focus #4)', async ({
	page
}) => {
	await mockDrafts(page, 200, draft);
	await newPlan(page);
	for (const fx of [0.3, 0.7]) await dragFromPalette(page, 'popper', await bayPoint(page, fx, 0.5));
	await expect(objects(page)).toHaveCount(2);
	await page.getByTestId('tool-measure').click();
	const a = (await objects(page).nth(0).boundingBox())!;
	const b = (await objects(page).nth(1).boundingBox())!;
	await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
	await page.mouse.down();
	await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
	await page.mouse.up();
	await expect(measures(page)).toHaveCount(1);

	const dialog = await drafted(page);
	await dialog.getByRole('button', { name: 'Apply draft' }).click();
	const confirm = page.getByRole('dialog', { name: 'Replace the objects?' });
	await expect(confirm).toContainText('Replace the 2 objects on this bay with the draft?');
	await confirm.getByRole('button', { name: 'Replace' }).click();
	await expect(objects(page)).toHaveCount(3);
	await expect(measures(page)).toHaveCount(0);
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(objects(page)).toHaveCount(2);
	await expect(measures(page)).toHaveCount(1);
});

test('offline, drafting is unavailable and nothing is sent (Review Focus #5)', async ({
	page,
	context
}) => {
	const calls = await mockDrafts(page, 200, draft);
	await newPlan(page);
	await context.setOffline(true);
	const button = page.getByRole('button', { name: 'Draft from text' });
	await expect(button).toBeDisabled();
	await expect(page.getByText('Drafting needs a connection.')).toBeVisible();
	expect(calls).toHaveLength(0);
});

test('the daily cap and the pause are explained', async ({ page }) => {
	await newPlan(page);
	await mockDrafts(page, 429, {
		code: 'capped',
		message: "You've used today's 20 drafts. Drafting resets at midnight UTC."
	});
	const dialog = await drafted(page);
	await expect(
		dialog.getByText("You've used today's 20 drafts. Drafting resets at midnight UTC.")
	).toBeVisible();
	await page.unroute('**/api/drafts');
	await mockDrafts(page, 503, { code: 'paused', message: 'Drafting is paused for today.' });
	await dialog.getByRole('button', { name: 'Draft layout' }).click();
	await expect(dialog.getByText('Drafting is paused for today.')).toBeVisible();
});

test('a refused draft says so and leaves the plan alone (Review Focus #3)', async ({ page }) => {
	await mockDrafts(page, 200, { status: 'refused', objects: [], unrepresentable: [], dropped: [] });
	await newPlan(page);
	const dialog = await drafted(page);
	await expect(dialog.getByText(/declined to draft this stage/)).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Apply draft' })).toHaveCount(0);
	await expect(objects(page)).toHaveCount(0);
});

test('a stage without a procedure asks for one first', async ({ page }) => {
	await newPlan(page, '');
	await page.getByRole('button', { name: 'Draft from text' }).click();
	const dialog = page.getByRole('dialog', { name: 'Draft from text' });
	await expect(
		dialog.getByText('Write the stage procedure first; the draft follows it.')
	).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Draft layout' })).toBeDisabled();
});
