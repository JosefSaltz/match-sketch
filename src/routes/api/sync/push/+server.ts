import { requireApiUser } from '#lib/server/auth.js';
import { serverDb } from '#lib/server/db/index.js';
import { pushRecords } from '#lib/server/sync.js';
import { PushRequestSchema } from '#lib/sync/wire.js';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store' };

/** Applies a device's changes for the signed-in user (spec §7.9, plan 5b Decision 2). */
export const POST: RequestHandler = async (event) => {
	const user = await requireApiUser(event);
	const body: unknown = await event.request.json().catch(() => null);
	const parsed = PushRequestSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json(
			{ error: 'invalid', issues: parsed.error.issues },
			{ status: 400, headers: NO_STORE }
		);
	}
	const results = await pushRecords(serverDb(), user.id, parsed.data.records);
	return Response.json({ results }, { headers: NO_STORE });
};
