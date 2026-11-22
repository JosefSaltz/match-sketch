import { expect, test } from '@playwright/test';
import { MD, SIGNED_OUT, signIn } from './support/accounts';

test.use({ storageState: SIGNED_OUT });

test('signed out, an app page sends you to sign in and back', async ({ page }) => {
	await page.goto('/plans/new');
	await expect(page).toHaveURL('/sign-in?next=%2Fplans%2Fnew');
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
	await signIn(page, MD);
	await expect(page).toHaveURL('/plans/new');
});

test('a wrong password says so', async ({ page }) => {
	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(MD.email);
	await page.getByLabel('Password').fill('not-the-password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByText('Wrong email or password.')).toBeVisible();
	await expect(page).toHaveURL(/\/sign-in/);
});

test('signing out returns to sign in and locks the app', async ({ page }) => {
	await signIn(page, MD);
	await expect(page.getByRole('heading', { level: 1, name: 'Match Sketch' })).toBeVisible();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/sign-in/);
	await page.goto('/');
	await expect(page).toHaveURL('/sign-in?next=%2F');
});

test('a next link to another site lands on home (Review Focus #1)', async ({ page }) => {
	await page.goto('/sign-in?next=//evil.example');
	await signIn(page, MD);
	await expect(page).toHaveURL('/');
});
