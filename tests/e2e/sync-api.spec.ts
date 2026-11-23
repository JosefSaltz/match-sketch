import { expect, test as signedOut } from '@playwright/test';
import { test } from './fixtures';

signedOut('signed out, the sync endpoints answer 401', async ({ request }) => {
	expect((await request.post('/api/sync/push', { data: { records: [] } })).status()).toBe(401);
	expect((await request.get('/api/sync/pull?cursor=0')).status()).toBe(401);
});

test('a malformed push is refused with 400', async ({ page }) => {
	const response = await page.request.post('/api/sync/push', { data: { records: 'nope' } });
	expect(response.status()).toBe(400);
});

test('a signed-in device pushes and pulls its own records', async ({ page }) => {
	const id = crypto.randomUUID();
	const record = {
		table: 'canvases',
		id,
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		name: 'Bay 7',
		widthFt: 90,
		depthFt: 60,
		unit: 'yd'
	};
	const push = await page.request.post('/api/sync/push', {
		data: { records: [{ record, baseVersion: 0 }] }
	});
	expect(push.status()).toBe(200);
	expect(await push.json()).toEqual({
		results: [{ status: 'accepted', table: 'canvases', id, version: 1 }]
	});
	const pull = await page.request.get('/api/sync/pull?cursor=0');
	expect(pull.headers()['cache-control']).toBe('no-store');
	const body = (await pull.json()) as { records: { id: string }[] };
	expect(body.records.map((r) => r.id)).toContain(id);
});
