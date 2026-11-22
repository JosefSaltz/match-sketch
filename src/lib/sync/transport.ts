import type { Transport } from './engine';
import { PullResponseSchema, PushResponseSchema } from './wire';

/** The server's sync endpoints (src/routes/api/sync). A 401 throws `signed-out`. */
export function fetchTransport(fetchFn: typeof fetch = fetch): Transport {
	async function call(url: string, init?: RequestInit): Promise<unknown> {
		const response = await fetchFn(url, { ...init, cache: 'no-store' });
		if (response.status === 401) throw new Error('signed-out');
		if (!response.ok) throw new Error(`Sync request failed: ${response.status}`);
		return response.json();
	}
	return {
		async push(records) {
			const body = await call('/api/sync/push', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ records })
			});
			return PushResponseSchema.parse(body).results;
		},
		async pull(cursor) {
			return PullResponseSchema.parse(await call(`/api/sync/pull?cursor=${cursor}`));
		}
	};
}
