import { test, expect, type Page } from '@playwright/test';
import { createCanvas, createMatch, createPlanFromCanvas } from './helpers';

const myMatches = (page: Page) => page.getByRole('region', { name: 'My matches' });
const unassigned = (page: Page) => page.getByRole('region', { name: 'Unassigned plans' });

test.describe('home page', () => {
	test('create a match from the home page', async ({ page }) => {
		await page.goto('/');
		await expect(myMatches(page)).toContainText('No matches yet.');
		await createMatch(page, 'DRRC November', '2026-11-29');
		await page.goto('/');
		const card = myMatches(page).getByRole('listitem');
		await expect(card).toHaveCount(1);
		await expect(card).toContainText('DRRC November');
		await expect(card).toContainText('Nov 29, 2026');
		await expect(card).toContainText('0 stages');
	});

	test('a new match needs a name', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'New match' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Create match' }).click();
		await expect(page.getByRole('dialog').getByText('Enter a name')).toBeVisible();
		await expect(page).toHaveURL(/\/$/);
	});

	test('an undated match says so', async ({ page }) => {
		await page.goto('/');
		await createMatch(page, 'Fun shoot');
		await page.goto('/');
		await expect(myMatches(page).getByRole('listitem')).toContainText('No date');
	});

	test('plans list under "Unassigned plans"', async ({ page }) => {
		await page.goto('/');
		await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
		await createPlanFromCanvas(page, 'Bay A');
		await page.goto('/');
		await expect(unassigned(page).getByRole('listitem')).toContainText('Untitled stage');
	});

	test('delete an empty match', async ({ page }) => {
		await page.goto('/');
		await createMatch(page, 'Scrap');
		await page.goto('/');
		await myMatches(page).getByRole('button', { name: 'Delete' }).click();
		await expect(page.getByRole('dialog')).toContainText('Delete match "Scrap"?');
		await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
		await expect(myMatches(page).getByRole('listitem')).toHaveCount(0);
	});
});

/** A plan on canvas "Bay A" with its stage name typed into the brief; ends on the editor. */
async function namedPlan(page: Page, name: string) {
	await page.goto('/');
	await createPlanFromCanvas(page, 'Bay A');
	await page.getByRole('tab', { name: 'Brief' }).click();
	const field = page.getByRole('tabpanel', { name: 'Brief' }).getByLabel('Stage name');
	await field.fill(name);
	await field.blur();
	await expect(page.getByTestId('save-status')).toHaveText('Saved');
}

const stages = (page: Page) => page.getByRole('region', { name: 'Stages' }).getByRole('listitem');

async function addExisting(page: Page, names: string[]) {
	await page.getByRole('button', { name: 'Add existing plan' }).click();
	const dialog = page.getByRole('dialog');
	for (const name of names) {
		await dialog
			.getByRole('listitem')
			.filter({ hasText: name })
			.getByRole('button', { name: 'Add' })
			.click();
	}
	await dialog.getByRole('button', { name: 'Done' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('match screen', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
		for (const name of ['Alpha', 'Bravo', 'Charlie']) await namedPlan(page, name);
		await page.goto('/');
		await createMatch(page, 'DRRC November', '2026-11-29');
	});

	test('add existing plans; stage numbers follow the order', async ({ page }) => {
		await expect(page.getByRole('heading', { level: 1, name: 'DRRC November' })).toBeVisible();
		await addExisting(page, ['Alpha', 'Bravo', 'Charlie']);
		await expect(stages(page)).toHaveCount(3);
		await expect(stages(page).nth(0)).toContainText('Stage 1 — Alpha');
		await expect(stages(page).nth(1)).toContainText('Stage 2 — Bravo');
		await expect(stages(page).nth(2)).toContainText('Stage 3 — Charlie');
		await page.goto('/');
		await expect(unassigned(page).getByRole('listitem')).toHaveCount(0);
		await expect(myMatches(page).getByRole('listitem')).toContainText('3 stages');
	});

	test('reorder by buttons and by dragging the handle', async ({ page }) => {
		await addExisting(page, ['Alpha', 'Bravo', 'Charlie']);
		await page.getByRole('button', { name: 'Move stage 1 down' }).click();
		await expect(stages(page).nth(0)).toContainText('Stage 1 — Bravo');
		await expect(stages(page).nth(1)).toContainText('Stage 2 — Alpha');

		const handle = page.getByRole('button', { name: 'Reorder stage 3' });
		const h = (await handle.boundingBox())!;
		const top = (await stages(page).nth(0).boundingBox())!;
		await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
		await page.mouse.down();
		await page.mouse.move(h.x + h.width / 2, top.y + 4, { steps: 10 });
		await page.mouse.up();
		await expect(stages(page).nth(0)).toContainText('Stage 1 — Charlie');
		await page.reload();
		await expect(stages(page).nth(0)).toContainText('Stage 1 — Charlie');
		await expect(stages(page).nth(1)).toContainText('Stage 2 — Bravo');
		await expect(stages(page).nth(2)).toContainText('Stage 3 — Alpha');
	});

	test('remove a stage keeps the plan as unassigned', async ({ page }) => {
		await addExisting(page, ['Alpha', 'Bravo']);
		await stages(page).filter({ hasText: 'Alpha' }).getByRole('button', { name: 'Remove' }).click();
		await expect(stages(page)).toHaveCount(1);
		await expect(stages(page).nth(0)).toContainText('Stage 1 — Bravo');
		await page.goto('/');
		await expect(unassigned(page)).toContainText('Alpha');
	});

	test('deleting a match keeps its plans as unassigned', async ({ page }) => {
		await addExisting(page, ['Alpha']);
		await page.goto('/');
		await myMatches(page).getByRole('button', { name: 'Delete' }).click();
		await expect(page.getByRole('dialog')).toContainText(
			'Delete match "DRRC November"? Its 1 stage stays as an unassigned plan.'
		);
		await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
		await expect(myMatches(page).getByRole('listitem')).toHaveCount(0);
		await expect(unassigned(page)).toContainText('Alpha');
	});

	test('rename and date the match', async ({ page }) => {
		const name = page.getByLabel('Name');
		await name.fill('DRRC December');
		await name.blur();
		await page.getByLabel('Date').fill('2026-12-27');
		await page.getByLabel('Date').blur();
		await expect(page.getByRole('heading', { level: 1, name: 'DRRC December' })).toBeVisible();
		await page.reload();
		await expect(page.getByLabel('Name')).toHaveValue('DRRC December');
		await expect(page.getByLabel('Date')).toHaveValue('2026-12-27');
	});

	test('open a stage from the match', async ({ page }) => {
		await addExisting(page, ['Bravo']);
		await stages(page).getByRole('link', { name: 'Open' }).click();
		await expect(page.getByTestId('bay')).toBeVisible();
	});
});

test('an unknown match says so', async ({ page }) => {
	await page.goto(`/matches/${crypto.randomUUID()}`);
	await expect(page.getByRole('heading', { name: 'Match not found' })).toBeVisible();
});
