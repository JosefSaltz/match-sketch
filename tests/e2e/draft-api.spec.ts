import { expect, test as signedOut } from '@playwright/test';
import { emptyPlanDocument } from '../../src/lib/model/plan';
import { test } from './fixtures';

const body = () => ({
	planId: crypto.randomUUID(),
	description: 'Engage two poppers from SA-1.',
	brief: emptyPlanDocument().brief,
	canvas: { widthFt: 60, depthFt: 90, unit: 'yd' },
	symbolSize: 'medium'
});

signedOut('signed out, drafting answers 401', async ({ request }) => {
	expect((await request.post('/api/drafts', { data: body() })).status()).toBe(401);
});

test('without an API key on the server, drafting says it is not set up', async ({ page }) => {
	test.skip(!!process.env.ANTHROPIC_API_KEY, 'this run has a real key');
	const response = await page.request.post('/api/drafts', { data: body() });
	expect(response.status()).toBe(503);
	expect(await response.json()).toMatchObject({ message: "Drafting isn't set up on this server." });
});
