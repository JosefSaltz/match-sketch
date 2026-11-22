import { z } from 'zod';
import { requireApiUser } from '#lib/server/auth.js';
import { serverDb } from '#lib/server/db/index.js';
import { pullChanges } from '#lib/server/sync.js';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store' };
const Cursor = z.coerce.number().int().min(0).default(0);

/** The signed-in user's records changed after `?cursor=` (spec §7.9). */
export const GET: RequestHandler = async (event) => {
	const user = await requireApiUser(event);
	const cursor = Cursor.safeParse(event.url.searchParams.get('cursor') ?? undefined);
	if (!cursor.success) {
		return Response.json({ error: 'invalid cursor' }, { status: 400, headers: NO_STORE });
	}
	return Response.json(await pullChanges(serverDb(), user.id, cursor.data), { headers: NO_STORE });
};
