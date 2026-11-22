import { expect, test } from '@playwright/test';
import { SIGNED_OUT } from './support/accounts';

test.use({ storageState: SIGNED_OUT });

test('the health check answers without a session', async ({ request }) => {
	const response = await request.get('/health');
	expect(response.status()).toBe(200);
	expect(await response.text()).toBe('ok');
});
