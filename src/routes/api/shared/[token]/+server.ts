import { serverDb } from '#lib/server/db/index.js';
import { getSharedView } from '#lib/server/shared.js';
import type { RequestHandler } from './$types';

/** Shared links are live and private to whoever has them: never cached, never indexed. */
const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };

/** A shared stage or match, for anyone with the link; no sign-in (spec §7.11). */
export const GET: RequestHandler = async ({ params }) => {
	const view = await getSharedView(serverDb(), params.token);
	if (!view) return Response.json({ error: 'not-found' }, { status: 404, headers: HEADERS });
	return Response.json(view, { headers: HEADERS });
};
