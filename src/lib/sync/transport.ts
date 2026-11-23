import type { Transport } from './engine';
import { PullResponseSchema, PushResponseSchema } from './wire';

/** How long one sync request may take; a stuck one would hold the sync lock (and sign-out). */
export const SYNC_REQUEST_TIMEOUT_MS = 20_000;

/** The server's sync endpoints (src/routes/api/sync). A 401 throws `signed-out`. */
export function fetchTransport(
	fetchFn: typeof fetch = fetch,
	timeoutMs: number = SYNC_REQUEST_TIMEOUT_MS
): Transport {
	async function call(url: string, init?: RequestInit): Promise<unknown> {
		const response = await fetchFn(url, {
			...init,
			cache: 'no-store',
			signal: AbortSignal.timeout(timeoutMs)
		});
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
