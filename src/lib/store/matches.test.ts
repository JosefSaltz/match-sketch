import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyPlanDocument } from '../model/plan';
import { createDb, type MatchSketchDB } from './db';
import {
	assignPlan,
	createMatch,
	deleteMatch,
	getMatch,
	listMatches,
	listMatchPlans,
	reorderMatchPlans,
	unassignedPlans,
	updateMatch
} from './matches';
import {
	createPlan,
	deletePlan,
	duplicatePlan,
	getPlan,
	listPlans,
	savePlanDocument
} from './plans';
import { effectiveStageNumber, MatchInputSchema, planTitle, type PlanRecord } from './records';

let db: MatchSketchDB;
beforeEach(() => {
	db = createDb(`test-${crypto.randomUUID()}`);
});

const bay = { name: 'Bay A', widthFt: 150, depthFt: 75, unit: 'yd' as const };
const plan = (matchId: string | null = null) =>
	createPlan(db, { canvas: bay, sourceCanvasId: null, matchId });
const ids = (plans: PlanRecord[]) => plans.map((p) => p.id);

function withNumber(p: PlanRecord, stageNumber: string): PlanRecord {
	return { ...p, document: { ...p.document, brief: { ...p.document.brief, stageNumber } } };
}

describe('stage numbers', () => {
	it('follow the match order unless typed', async () => {
		const [a, b, c] = [await plan(), await plan(), await plan()];
		const order = [a.id, b.id, c.id];
		expect(effectiveStageNumber(b, order)).toBe('2');
		expect(effectiveStageNumber(withNumber(b, ' 7 '), order)).toBe('7');
		expect(effectiveStageNumber(b, null)).toBe('');
		expect(effectiveStageNumber(b, [a.id])).toBe('');
	});

	it('planTitle uses the number it is given', async () => {
		const p = await plan();
		const named = {
			...p,
			document: { ...p.document, brief: { ...p.document.brief, stageName: 'Bunker' } }
		};
		expect(planTitle(named, '2')).toBe('Stage 2 — Bunker');
		expect(planTitle(named)).toBe('Bunker');
	});
});

describe('match repository', () => {
	it('rejects a blank match name and accepts a blank date', () => {
		expect(MatchInputSchema.safeParse({ name: '  ', date: '' }).success).toBe(false);
		expect(MatchInputSchema.safeParse({ name: 'DRRC', date: '' }).success).toBe(true);
		expect(MatchInputSchema.safeParse({ name: 'DRRC', date: '2026-13-40' }).success).toBe(false);
	});

	it('creates, updates and gets a match with sync fields', async () => {
		const m = await createMatch(db, { name: ' DRRC November ', date: '2026-11-29' });
		expect(m).toMatchObject({ name: 'DRRC November', date: '2026-11-29', version: 0, dirty: 1 });
		const u = await updateMatch(db, m.id, { name: 'DRRC Dec', date: '' });
		expect(u.updatedAt > m.updatedAt).toBe(true);
		expect(await getMatch(db, m.id)).toMatchObject({ name: 'DRRC Dec', date: '' });
	});

	it('lists matches newest first with undated last', async () => {
		await createMatch(db, { name: 'Undated', date: '' });
		await createMatch(db, { name: 'Older', date: '2026-01-10' });
		await createMatch(db, { name: 'Newer', date: '2026-11-29' });
		expect((await listMatches(db)).map((m) => m.name)).toEqual(['Newer', 'Older', 'Undated']);
	});

	it('assigning appends; reordering renumbers', async () => {
		const m = await createMatch(db, { name: 'M', date: '' });
		const [a, b, c] = [await plan(), await plan(), await plan()];
		for (const p of [a, b, c]) await assignPlan(db, p.id, m.id);
		expect(ids(await listMatchPlans(db, m.id))).toEqual([a.id, b.id, c.id]);
		await reorderMatchPlans(db, m.id, [c.id, a.id, b.id]);
		expect(ids(await listMatchPlans(db, m.id))).toEqual([c.id, a.id, b.id]);
		await assignPlan(db, a.id, null);
		expect(await getPlan(db, a.id)).toMatchObject({ matchId: null, stageOrder: null, dirty: 1 });
		expect(ids(await listMatchPlans(db, m.id))).toEqual([c.id, b.id]);
	});

	it('a new plan created in a match is its last stage', async () => {
		const m = await createMatch(db, { name: 'M', date: '' });
		const a = await plan(m.id);
		const b = await plan(m.id);
		expect(ids(await listMatchPlans(db, m.id))).toEqual([a.id, b.id]);
	});

	it('deleting a plan closes the gap in the match', async () => {
		// Review Focus #3
		const m = await createMatch(db, { name: 'M', date: '' });
		const [a, b, c] = [await plan(m.id), await plan(m.id), await plan(m.id)];
		await deletePlan(db, b.id);
		const order = ids(await listMatchPlans(db, m.id));
		expect(order).toEqual([a.id, c.id]);
		expect(effectiveStageNumber(c, order)).toBe('2');
	});

	it('deleting a match unassigns its plans and keeps them', async () => {
		const m = await createMatch(db, { name: 'M', date: '' });
		const p = await plan(m.id);
		await deleteMatch(db, m.id);
		expect(await getPlan(db, p.id)).toMatchObject({ matchId: null, stageOrder: null, dirty: 1 });
		expect(await listMatches(db)).toEqual([]);
		expect(await getMatch(db, m.id)).toBeUndefined();
	});

	it('duplicating a plan in a match appends the copy', async () => {
		const m = await createMatch(db, { name: 'M', date: '' });
		const a = await plan(m.id);
		const b = await plan(m.id);
		await savePlanDocument(db, a.id, emptyPlanDocument());
		const copy = await duplicatePlan(db, a.id);
		expect(ids(await listMatchPlans(db, m.id))).toEqual([a.id, b.id, copy.id]);
	});
});

describe('unassignedPlans', () => {
	it('treats a plan whose match was deleted (on another device) as unassigned', async () => {
		const bay = { name: 'Bay', widthFt: 90, depthFt: 60, unit: 'yd' as const };
		const live = await createMatch(db, { name: 'Live', date: '' });
		const inLive = await createPlan(db, { canvas: bay, sourceCanvasId: null, matchId: live.id });
		const loose = await createPlan(db, { canvas: bay, sourceCanvasId: null });
		const orphan = await createPlan(db, { canvas: bay, sourceCanvasId: null });
		await db.plans.update(orphan.id, { matchId: crypto.randomUUID(), stageOrder: 0 });
		const plans = await listPlans(db);
		const ids = unassignedPlans(plans, await listMatches(db)).map((p) => p.id);
		expect(ids.sort()).toEqual([loose.id, orphan.id].sort());
		expect(ids).not.toContain(inLive.id);
	});
});
