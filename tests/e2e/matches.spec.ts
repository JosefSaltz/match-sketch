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
