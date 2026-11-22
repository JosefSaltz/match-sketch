import { emptyPlanDocument, PlanDocumentSchema, type PlanDocument } from '../model/plan';
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
		schemaVersion: 1,
		document: emptyPlanDocument()
	};
	await db.plans.add(record);
	return record;
}

export async function getPlan(db: MatchSketchDB, id: string): Promise<PlanRecord | undefined> {
	const plan = await db.plans.get(id);
	return plan && plan.deletedAt === null ? plan : undefined;
}

/**
 * Validates and saves a plan's document. The write is issued before any other await so that
 * an edit followed immediately by a reload still lands.
 */
/** Saves a plan's document. `at` is when the edit was made (defaults to now). */
export async function savePlanDocument(
	db: MatchSketchDB,
	id: string,
	document: PlanDocument,
	at: string = now()
): Promise<PlanRecord> {
	const parsed = PlanDocumentSchema.parse(document);
	const updated = await db.plans.update(id, { document: parsed, updatedAt: at, dirty: 1 });
	if (!updated) throw new Error(`Plan ${id} not found`);
	const plan = await getPlan(db, id);
	if (!plan) throw new Error(`Plan ${id} not found`);
	return plan;
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
		document: { ...source.document, brief: { ...source.document.brief, stageName } }
	};
	await db.plans.add(record);
	return record;
}

export async function deletePlan(db: MatchSketchDB, id: string): Promise<void> {
	const stamp = now();
	await db.plans.update(id, { deletedAt: stamp, updatedAt: stamp, dirty: 1 });
}
