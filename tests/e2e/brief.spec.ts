import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

const brief = (page: Page) => page.getByRole('tabpanel', { name: 'Brief' });
const props = (page: Page) => page.getByRole('tabpanel', { name: 'Properties' });

async function openBrief(page: Page) {
	await page.getByRole('tab', { name: 'Brief' }).click();
	await expect(brief(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
});

test('brief fields save and come back after reload', async ({ page }) => {
	await openBrief(page);
	await brief(page).getByLabel('Stage name').fill('El Presidente');
	await brief(page).getByLabel('Par time').fill('10 s');
	await brief(page).getByLabel('Stage procedure').fill('Start in the box.\nEngage T1–T4.');
	await brief(page).getByLabel('Gun ready condition').fill('Loaded, holstered');
	await brief(page).getByLabel('Gun ready condition').blur();
	await expect(page.getByRole('banner')).toContainText('El Presidente');
	await page.reload();
	await openBrief(page);
	await expect(brief(page).getByLabel('Stage name')).toHaveValue('El Presidente');
	await expect(brief(page).getByLabel('Par time')).toHaveValue('10 s');
	await expect(brief(page).getByLabel('Stage procedure')).toHaveValue(
		'Start in the box.\nEngage T1–T4.'
	);
	await expect(brief(page).getByLabel('Gun ready condition')).toHaveValue('Loaded, holstered');
});

test('typed text survives a reload without leaving the field', async ({ page }) => {
	// Review Focus #1
	await openBrief(page);
	await brief(page).getByLabel('Start position').pressSequentially('Hands on X');
	await page.reload();
	await openBrief(page);
	await expect(brief(page).getByLabel('Start position')).toHaveValue('Hands on X');
});

test('one undo step per field visit', async ({ page }) => {
	await openBrief(page);
	const round = brief(page).getByLabel('Round count');
	await round.pressSequentially('abc');
	await round.blur();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(round).toHaveValue('');
	await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
	await page.getByRole('button', { name: 'Redo' }).click();
	await expect(round).toHaveValue('abc');
});

test('keys typed in the brief never edit the stage', async ({ page }) => {
	// Review Focus #2
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.5));
	await page.getByTestId('object').click();
	const x = await props(page).getByLabel('X').inputValue();
	const y = await props(page).getByLabel('Y').inputValue();
	await openBrief(page);
	const name = brief(page).getByLabel('Stage name');
	await name.pressSequentially('Bill drill');
	await name.press('Backspace');
	await name.press('ArrowLeft');
	await name.press('Delete');
	await name.press('ArrowUp');
	await expect(name).toHaveValue('Bill dri');
	await expect(page.getByTestId('object')).toHaveCount(1);
	await page.getByRole('tab', { name: 'Properties' }).click();
	await expect(props(page).getByLabel('X')).toHaveValue(x);
	await expect(props(page).getByLabel('Y')).toHaveValue(y);
});

test('notes sections can be added, filled and removed', async ({ page }) => {
	await openBrief(page);
	await brief(page).getByRole('button', { name: 'Add notes section' }).click();
	await brief(page).getByLabel('Title').fill('Bonuses');
	await brief(page).getByLabel('Text').fill('-1 s per popper');
	await brief(page).getByLabel('Text').blur();
	await page.reload();
	await openBrief(page);
	await expect(brief(page).getByLabel('Title')).toHaveValue('Bonuses');
	await expect(brief(page).getByLabel('Text')).toHaveValue('-1 s per popper');
	await brief(page).getByRole('button', { name: 'Remove section' }).click();
	await expect(brief(page).getByLabel('Title')).toHaveCount(0);
});

test('targets tally follows the diagram and can be overridden', async ({ page }) => {
	await dragFromPalette(page, 'paper', await bayPoint(page, 0.3, 0.5));
	await dragFromPalette(page, 'paper', await bayPoint(page, 0.5, 0.5));
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.7, 0.5));
	await page.getByTestId('object').first().click();
	await props(page).getByLabel('Count').fill('3');
	await props(page).getByLabel('Count').press('Enter');
	await openBrief(page);
	await expect(brief(page).getByTestId('targets-tally')).toHaveText(
		'4 paper targets, 1 knock-down popper'
	);
	await brief(page).getByRole('button', { name: 'Override' }).click();
	const targets = brief(page).getByLabel('Targets');
	await expect(targets).toHaveValue('4 paper targets, 1 knock-down popper');
	await targets.fill('4 paper, 1 popper (activator)');
	await targets.blur();
	await page.reload();
	await openBrief(page);
	await expect(brief(page).getByLabel('Targets')).toHaveValue('4 paper, 1 popper (activator)');
	await brief(page).getByRole('button', { name: 'Use computed tally' }).click();
	await expect(brief(page).getByTestId('targets-tally')).toHaveText(
		'4 paper targets, 1 knock-down popper'
	);
});

test('an empty diagram says there are no targets yet', async ({ page }) => {
	await openBrief(page);
	await expect(brief(page).getByTestId('targets-tally')).toHaveText('No targets yet');
});
