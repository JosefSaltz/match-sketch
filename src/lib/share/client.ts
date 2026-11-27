import { PLAN_SCHEMA_VERSION } from '../model/plan';
import type { PlanRecord } from '../store/records';
import { SharedViewSchema, type SharedPlan, type SharedView } from './view';

/** What a share link shows, or null when it isn't shared (or the reply isn't one we understand). */
export async function fetchSharedView(
	token: string,
	fetcher: typeof fetch = fetch
): Promise<SharedView | null> {
	const response = await fetcher(`/api/shared/${encodeURIComponent(token)}`, {
		headers: { accept: 'application/json' }
	});
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`Shared view failed: ${response.status}`);
	const parsed = SharedViewSchema.safeParse(await response.json());
	return parsed.success ? parsed.data : null;
}

/**
 * A shared plan in the shape the drawing and print components take. It isn't stored anywhere:
 * the sync fields are placeholders.
 */
export function asPlanRecord(plan: SharedPlan): PlanRecord {
	return {
		id: plan.id,
		version: 0,
		updatedAt: '',
		deletedAt: null,
		dirty: 0,
		matchId: null,
		stageOrder: null,
		sourceCanvasId: null,
		widthFt: plan.widthFt,
		depthFt: plan.depthFt,
		unit: plan.unit,
		schemaVersion: PLAN_SCHEMA_VERSION,
		document: plan.document,
		share: null
	};
}

/** The stage a link shows: the plan, or the match's stage `stageId`; null when there is none. */
export function sharedStage(
	view: SharedView,
	stageId: string | null
): { plan: SharedPlan; matchName: string; date: string; index: number; count: number } | null {
	if (view.kind === 'plan') {
		return { plan: view.plan, matchName: view.matchName, date: view.date, index: 0, count: 1 };
	}
	if (!stageId) return null;
	const index = view.plans.findIndex((p) => p.id === stageId);
	if (index < 0) return null;
	return {
		plan: view.plans[index],
		matchName: view.match.name,
		date: view.match.date,
		index,
		count: view.plans.length
	};
}
