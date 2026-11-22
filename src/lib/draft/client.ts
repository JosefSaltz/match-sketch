import type { DraftRequest, DraftResult } from './contract';

/**
 * A draft can take a few minutes (two model calls). The server gives up at its own deadline
 * (DRAFT_DEADLINE_MS, 4 minutes); the editor waits a little longer so it always hears the answer.
 */
export const DRAFT_TIMEOUT_MS = 300_000;

export type DraftReply = { ok: true; result: DraftResult } | { ok: false; message: string };

/** Asks the server for a draft (src/routes/api/drafts); never throws. */
export async function requestDraft(
	request: DraftRequest,
	fetchFn: typeof fetch = fetch,
	timeoutMs: number = DRAFT_TIMEOUT_MS
): Promise<DraftReply> {
	let response: Response;
	try {
		response = await fetchFn('/api/drafts', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(request),
			signal: AbortSignal.timeout(timeoutMs)
		});
	} catch (e) {
		const timedOut = e instanceof DOMException && e.name === 'TimeoutError';
		return {
			ok: false,
			message: timedOut ? 'The draft took too long. Try again.' : 'Drafting needs a connection.'
		};
	}
	const body = (await response.json().catch(() => null)) as unknown;
	if (response.ok) return { ok: true, result: body as DraftResult };
	const message =
		body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
			? body.message
			: `Couldn't draft this stage (error ${response.status}).`;
	return { ok: false, message };
}

/** What to tell the MD when the model gave no usable draft; null when there is one. */
export function draftProblem(result: DraftResult): string | null {
	if (result.status === 'refused') {
		return 'Claude declined to draft this stage. Try rewording the description.';
	}
	if (result.status === 'failed') return "The draft didn't work this time. Try again.";
	return null;
}
