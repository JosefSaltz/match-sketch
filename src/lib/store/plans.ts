import {
	emptyPlanDocument,
	PLAN_SCHEMA_VERSION,
	PlanDocumentSchema,
	type PlanDocument
} from '../model/plan';
import type { MatchSketchDB } from './db';
import { nextStageOrder } from './matches';
import { CanvasInputSchema, newSyncMeta, now, type CanvasInput, type PlanRecord } from './records';

export async function listPlans(db: MatchSketchDB): Promise<PlanRecord[]> {
	const all = await db.plans.toArray();
	return all
		.filter((p) => p.deletedAt === null)
		.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

/**
 * Creates a plan with its own copy of the canvas dimensions (not a live link). With `matchId`,
 * the plan joins that match as its last stage.
 */
export async function createPlan(
	db: MatchSketchDB,
	input: { canvas: CanvasInput; sourceCanvasId: string | null; matchId?: string | null }
): Promise<PlanRecord> {
	const { widthFt, depthFt, unit } = CanvasInputSchema.parse(input.canvas);
	const matchId = input.matchId ?? null;
	const record: PlanRecord = {
		...newSyncMeta(),
		matchId,
		stageOrder: matchId ? await nextStageOrder(db, matchId) : null,
		sourceCanvasId: input.sourceCanvasId,
		widthFt,
		depthFt,
		unit,
		schemaVersion: PLAN_SCHEMA_VERSION,
		document: emptyPlanDocument(),
		share: null
	};
	await db.plans.add(record);
	return record;
}

export async function getPlan(db: MatchSketchDB, id: string): Promise<PlanRecord | undefined> {
	const plan = await db.plans.get(id);
	return plan && plan.deletedAt === null ? plan : undefined;
}

/** The stored plan changed after the edit's base (a pull or a conflict put another version in). */
export class StalePlanError extends Error {
	constructor(readonly planId: string) {
		super(`Plan ${planId} changed on another device`);
	}
}

/**
 * Validates and saves a plan's document; `at` is when the edit was made (defaults to now).
 * With `expectedUpdatedAt`, it saves only if the stored plan is still the version the edit was
 * made on, and otherwise throws `StalePlanError` without writing, so an open editor can never
 * save over another device's version.
 */
export async function savePlanDocument(
	db: MatchSketchDB,
	id: string,
	document: PlanDocument,
	at: string = now(),
	expectedUpdatedAt?: string
): Promise<PlanRecord> {
	const parsed = PlanDocumentSchema.parse(document);
	return db.transaction('rw', db.plans, async () => {
		const current = await db.plans.get(id);
		if (!current || current.deletedAt !== null) {
			if (current && expectedUpdatedAt !== undefined) throw new StalePlanError(id);
			throw new Error(`Plan ${id} not found`);
		}
		if (expectedUpdatedAt !== undefined && current.updatedAt !== expectedUpdatedAt) {
			throw new StalePlanError(id);
		}
		const saved: PlanRecord = { ...current, document: parsed, updatedAt: at, dirty: 1 };
		await db.plans.put(saved);
		return saved;
	});
}

export async function duplicatePlan(db: MatchSketchDB, id: string): Promise<PlanRecord> {
	const source = await getPlan(db, id);
	if (!source) throw new Error(`Plan ${id} not found`);
	const stageName = `${source.document.brief.stageName.trim() || 'Untitled stage'} (copy)`;
	const record: PlanRecord = {
		...source,
		...newSyncMeta(),
		// A copy of a stage joins the same match, after its last stage.
		stageOrder: source.matchId ? await nextStageOrder(db, source.matchId) : null,
		share: null,
		document: { ...source.document, brief: { ...source.document.brief, stageName } }
	};
	await db.plans.add(record);
	return record;
}

export async function deletePlan(db: MatchSketchDB, id: string): Promise<void> {
	const stamp = now();
	await db.plans.update(id, { deletedAt: stamp, updatedAt: stamp, dirty: 1 });
}
