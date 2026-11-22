import type { PrintMatch } from '#lib/print/input.js';
import { getDb } from '#lib/store/index.js';
import { recoverUnsavedEdits } from '#lib/store/journal.js';
import { getMatch, listMatchPlans } from '#lib/store/matches.js';
import { getPlan } from '#lib/store/plans.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const db = getDb();
	const found = await getPlan(db, params.id);
	// Print what the editor last showed, including an edit that only reached the journal.
	const plan = found ? await recoverUnsavedEdits(db, localStorage, found) : null;
	const m = plan?.matchId ? await getMatch(db, plan.matchId) : undefined;
	const match: PrintMatch | null = m
		? { name: m.name, date: m.date, order: (await listMatchPlans(db, m.id)).map((p) => p.id) }
		: null;
	return { plan, match };
};
