import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, type MatchSketchDB } from './db';
import { createCanvas, updateCanvas } from './canvases';
import {
	createPlan,
	getPlan,
	savePlanDocument,
	duplicatePlan,
	listPlans,
	deletePlan
} from './plans';
import { planTitle } from './records';
import { emptyPlanDocument } from '../model/plan';

let db: MatchSketchDB;
beforeEach(() => {
	db = createDb(`test-${crypto.randomUUID()}`);
});

describe('plan repository', () => {
	it('copies canvas dimensions into a new plan', async () => {
		const bay = await createCanvas(db, { name: 'Bay A', widthFt: 150, depthFt: 75, unit: 'yd' });
		const p = await createPlan(db, { canvas: bay, sourceCanvasId: bay.id });
		expect(p).toMatchObject({
			widthFt: 150,
			depthFt: 75,
			unit: 'yd',
			sourceCanvasId: bay.id,
			schemaVersion: 1
		});
		expect(p.document).toEqual(emptyPlanDocument());
		await updateCanvas(db, bay.id, { name: 'Bay A', widthFt: 300, depthFt: 75, unit: 'yd' });
		expect((await getPlan(db, p.id))?.widthFt).toBe(150); // copy, not link
	});

	it('validates documents before saving', async () => {
		const bay = await createCanvas(db, { name: 'Bay A', widthFt: 150, depthFt: 75, unit: 'yd' });
		const p = await createPlan(db, { canvas: bay, sourceCanvasId: bay.id });
		const bad = {
			...p.document,
			objects: [
				{ id: crypto.randomUUID(), symbolId: 'popper', x: 1, y: 1, rotation: 0, z: 0, count: 0 }
			]
		};
		await expect(savePlanDocument(db, p.id, bad)).rejects.toThrow();
		const good = {
			...p.document,
			brief: { ...p.document.brief, stageNumber: '3', stageName: 'Bunker' }
		};
		await savePlanDocument(db, p.id, good);
		expect((await getPlan(db, p.id))?.document).toEqual(good);
		expect(planTitle((await getPlan(db, p.id))!)).toBe('Stage 3 — Bunker');
	});

	it('duplicates, lists newest first, and soft-deletes', async () => {
		const bay = await createCanvas(db, { name: 'Bay A', widthFt: 150, depthFt: 75, unit: 'yd' });
		const p = await createPlan(db, { canvas: bay, sourceCanvasId: bay.id });
		await savePlanDocument(db, p.id, {
			...p.document,
			brief: { ...p.document.brief, stageName: 'Bunker' }
		});
		const dup = await duplicatePlan(db, p.id);
		expect(dup.document.brief.stageName).toBe('Bunker (copy)');
		expect((await listPlans(db))[0].id).toBe(dup.id);
		await deletePlan(db, p.id);
		expect(await getPlan(db, p.id)).toBeUndefined();
	});
});
