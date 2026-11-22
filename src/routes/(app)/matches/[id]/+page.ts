import { getDb } from '#lib/store/index.js';
import { getMatch, listMatchPlans } from '#lib/store/matches.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const db = getDb();
	const match = (await getMatch(db, params.id)) ?? null;
	return { match, plans: match ? await listMatchPlans(db, match.id) : [] };
};
