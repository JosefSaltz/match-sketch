import { getDb } from '#lib/store/index.js';
import { recoverUnsavedEdits } from '#lib/store/journal.js';
import { getPlan } from '#lib/store/plans.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const db = getDb();
	const plan = await getPlan(db, params.id);
	// An edit made just before a reload may only have reached the journal; apply it first.
	return { plan: plan ? await recoverUnsavedEdits(db, localStorage, plan) : null };
};
