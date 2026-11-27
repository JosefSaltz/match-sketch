import { expect, test } from '@playwright/test';
import { SIGNED_OUT } from './support/accounts';

test.use({ storageState: SIGNED_OUT });

test('a link that is not shared gets the same 404 whatever it looks like', async ({ request }) => {
	const malformed = await request.get('/api/shared/nope');
	const unknown = await request.get('/api/shared/AbCdEfGhIjKlMnOpQrStUv');
	for (const response of [malformed, unknown]) {
		expect(response.status()).toBe(404);
		expect(response.headers()['x-robots-tag']).toBe('noindex');
		expect(response.headers()['cache-control']).toBe('no-store');
	}
	expect(await malformed.json()).toEqual(await unknown.json());
});
