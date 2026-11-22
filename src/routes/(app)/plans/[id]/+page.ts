import type { MatchContext } from '#lib/editor/editor-state.svelte.js';
import { getDb } from '#lib/store/index.js';
import { recoverUnsavedEdits } from '#lib/store/journal.js';
import { getMatch, listMatchPlans } from '#lib/store/matches.js';
import { getPlan } from '#lib/store/plans.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const db = getDb();
	const plan = await getPlan(db, params.id);
	const match = plan?.matchId ? await getMatch(db, plan.matchId) : undefined;
	const matchContext: MatchContext | null = match
		? {
				id: match.id,
				name: match.name,
				order: (await listMatchPlans(db, match.id)).map((p) => p.id)
			}
		: null;
	// An edit made just before a reload may only have reached the journal; apply it first.
	return {
		plan: plan ? await recoverUnsavedEdits(db, localStorage, plan) : null,
		match: matchContext
	};
};
