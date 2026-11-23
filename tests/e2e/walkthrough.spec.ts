import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bayPoint, createCanvas, createPlanFromCanvas, dragFromPalette } from './helpers';

const panel = (page: Page, name: string) => page.getByRole('tabpanel', { name });

async function writeProcedure(page: Page, text: string) {
	await page.getByRole('tab', { name: 'Brief' }).click();
	const field = panel(page, 'Brief').getByLabel('Stage procedure');
	await field.fill(text);
	await field.blur();
}

async function pickStep(page: Page, text: string) {
	await page.getByRole('tab', { name: 'Walkthrough' }).click();
	await panel(page, 'Walkthrough').getByRole('button', { name: text }).click();
}

async function mark(page: Page, meaning: string) {
	await panel(page, 'Walkthrough')
		.getByRole('group', { name: 'Mark the selected objects as' })
		.getByRole('button', { name: meaning })
		.click();
}

const highlights = (page: Page) => page.locator('[data-stage] [data-highlight]');

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '30', depth: '20', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
});

test('without a procedure the walkthrough asks for one', async ({ page }) => {
	await page.getByRole('tab', { name: 'Walkthrough' }).click();
	await expect(panel(page, 'Walkthrough')).toContainText(
		'Write the stage procedure in the Brief tab. Each line is a step.'
	);
	await expect(page.getByRole('button', { name: 'Present' })).toBeDisabled();
});

test('mark objects in steps, keep them through procedure edits, and present', async ({ page }) => {
	await writeProcedure(page, 'Start in the box\nEngage the popper\nMove to box B');
	await dragFromPalette(page, 'shooting-box', await bayPoint(page, 0.3, 0.8));
	await pickStep(page, 'Start in the box');
	await mark(page, 'Move');
	await expect(highlights(page)).toHaveCount(1);
	await expect(highlights(page)).toHaveAttribute('data-meaning', 'move');

	await dragFromPalette(page, 'popper', await bayPoint(page, 0.6, 0.3));
	await pickStep(page, 'Engage the popper');
	await mark(page, 'Shoot');
	await expect(highlights(page)).toHaveAttribute('data-meaning', 'shoot');
	await expect(
		panel(page, 'Walkthrough').getByRole('list', { name: 'Marked in this step' })
	).toContainText('Shoot');

	// A line inserted above keeps the popper's mark on its step (Review Focus #3).
	await writeProcedure(page, 'Start in the box\nReload\nEngage the popper\nMove to box B');
	await pickStep(page, 'Engage the popper');
	await expect(highlights(page)).toHaveCount(1);
	await expect(highlights(page)).toHaveAttribute('data-meaning', 'shoot');

	await page.getByRole('button', { name: 'Present' }).click();
	const player = page.getByRole('dialog', { name: 'Walkthrough' });
	await expect(player.getByTestId('step-count')).toHaveText('Step 1 of 4');
	await expect(player.getByTestId('step-text')).toHaveText('Start in the box');
	await expect(player.getByRole('list', { name: 'Legend' })).toHaveText('Move');
	await expect(player.getByRole('button', { name: 'Previous' })).toBeDisabled();
	await player.getByRole('button', { name: 'Next' }).click();
	await expect(player.getByTestId('step-text')).toHaveText('Reload');
	await expect(player.getByRole('list', { name: 'Legend' })).toHaveCount(0);
	await page.keyboard.press('ArrowRight');
	await expect(player.getByTestId('step-count')).toHaveText('Step 3 of 4');
	await expect(player.getByRole('list', { name: 'Legend' })).toHaveText('Shoot');
	await expect(player.locator('[data-highlight]')).toHaveAttribute('data-meaning', 'shoot');
	await player.getByRole('button', { name: 'Next' }).click();
	await expect(player.getByRole('button', { name: 'Next' })).toBeDisabled();
	await player.getByRole('button', { name: 'Back to stage' }).click();
	await expect(player).toHaveCount(0);
});

test('deleting a marked object removes its mark, and undo brings it back', async ({ page }) => {
	await writeProcedure(page, 'Engage the popper');
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.4));
	await pickStep(page, 'Engage the popper');
	await mark(page, 'Shoot');
	await expect(highlights(page)).toHaveCount(1);
	await page.keyboard.press('Delete');
	await expect(highlights(page)).toHaveCount(0);
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(highlights(page)).toHaveCount(1);
});
