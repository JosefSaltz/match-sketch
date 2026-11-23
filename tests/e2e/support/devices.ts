import { expect, type Browser, type Locator, type Page } from '@playwright/test';
import postgres from 'postgres';
import { requireLocal } from '../../../src/lib/server/testing/local-only';
import { signIn, type Account } from './accounts';

/** Another browser (its own IndexedDB) signed in as the same account. */
export async function otherDevice(browser: Browser, baseURL: string, account: Account) {
	const context = await browser.newContext({ baseURL, reducedMotion: 'reduce' });
	const page = await context.newPage();
	await signIn(page, account);
	return { context, page };
}

/** Waits for the sync indicator to settle on "Synced". */
export async function synced(page: Page, timeout = 15_000): Promise<void> {
	await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'Synced', {
		timeout
	});
}

/**
 * Waits for a local change to go up: the indicator shows it pending (edits wait 2 s to settle,
 * so this state is reliable to catch), then synced.
 */
export async function pushed(page: Page): Promise<void> {
	await expect(page.getByTestId('sync-status')).toHaveAttribute(
		'data-state',
		/Changes pending|Syncing…/
	);
	await synced(page);
}

/** Reloads `page` (each load syncs) until `locator` has `count` matches. */
export async function eventually(
	page: Page,
	locator: Locator,
	count: (n: number) => boolean,
	timeout = 20_000
): Promise<void> {
	await expect
		.poll(
			async () => {
				await page.reload();
				await synced(page);
				return count(await locator.count());
			},
			{ timeout, intervals: [250, 500, 1000] }
		)
		.toBe(true);
}

/** Runs SQL against the local stack's database (test setup only). */
export async function withSql<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
	const sql = postgres(requireLocal(process.env.DATABASE_URL), { max: 1 });
	try {
		return await fn(sql);
	} finally {
		await sql.end();
	}
}

export async function accountId(email: string): Promise<string> {
	return withSql(async (sql) => {
		const [row] = await sql<{ id: string }[]>`select id from auth.users where email = ${email}`;
		return row.id;
	});
}
