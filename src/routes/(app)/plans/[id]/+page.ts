import { getDb } from '#lib/store/index.js';
import { getPlan } from '#lib/store/plans.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	return { plan: (await getPlan(getDb(), params.id)) ?? null };
};
