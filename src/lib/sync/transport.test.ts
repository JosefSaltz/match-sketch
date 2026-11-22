import { describe, expect, it } from 'vitest';
import { fetchTransport } from './transport';

describe('fetchTransport', () => {
	it('gives up on a request that hangs, so a round never holds the sync lock for good', async () => {
		const hanging: typeof fetch = (_input, init) =>
			new Promise((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
			});
		await expect(fetchTransport(hanging, 30).pull(0)).rejects.toBeTruthy();
	});

	it('reports a lost session', async () => {
		const unauthorized: typeof fetch = () => Promise.resolve(new Response('', { status: 401 }));
		await expect(fetchTransport(unauthorized).pull(0)).rejects.toThrow('signed-out');
	});
});
