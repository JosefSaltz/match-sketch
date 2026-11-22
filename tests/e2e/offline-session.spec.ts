import { expect, test, type Page } from '@playwright/test';
import { MD, SIGNED_OUT, signIn } from './support/accounts';

test.use({ storageState: SIGNED_OUT });

/**
 * Signs in, then makes Supabase's token endpoint unreachable and lets the access token expire
 * (it lasts an hour). The client's refresh then retries for about 30 s.
 */
async function expiredAndUnreachable(page: Page) {
	await page.clock.install();
	await signIn(page, MD);
	await page.route('**/auth/v1/token**', (route) => route.abort('internetdisconnected'));
	await page.clock.fastForward('02:00:00');
}

test('with Supabase unreachable and the token expired, the app still opens promptly (Review Focus #2)', async ({
	page
}) => {
	await expiredAndUnreachable(page);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Match Sketch' })).toBeVisible({
		timeout: 3000
	});
	await expect(page).toHaveURL('/');
});

test('signing out with Supabase unreachable still signs this device out', async ({ page }) => {
	await expiredAndUnreachable(page);
	await page.reload();
	await page.getByRole('button', { name: 'Sign out' }).click({ timeout: 3000 });
	await expect(page).toHaveURL(/\/sign-in/, { timeout: 3000 });
	await page.unroute('**/auth/v1/token**');
	await page.goto('/');
	await expect(page).toHaveURL('/sign-in?next=%2F');
});
