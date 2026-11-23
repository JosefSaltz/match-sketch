import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyPlanDocument, type PlanDocument } from '../model/plan';
import { createDb, type MatchSketchDB } from '../store/db';
import { createPlan, getPlan } from '../store/plans';
import { getSetting, SYNC_CONFLICTS } from '../store/settings';
import { createPlanSaver } from './plan-saver';

const bay = { name: 'Bay', widthFt: 90, depthFt: 60, unit: 'yd' as const };
const named = (stageName: string): PlanDocument => {
	const d = emptyPlanDocument();
	return { ...d, brief: { ...d.brief, stageName } };
};
let db: MatchSketchDB;

beforeEach(() => {
	db = createDb(`saver-${crypto.randomUUID()}`);
});

describe("the editor's plan saver", () => {
	it('saves edits and follows its own writes', async () => {
		const plan = await createPlan(db, { canvas: bay, sourceCanvasId: null });
		const saver = createPlanSaver({ db, planId: plan.id, base: plan.updatedAt, onStale: vi.fn() });
		await saver.save(named('One'), '2026-11-22T10:00:00.000Z');
		await saver.save(named('Two'), '2026-11-22T10:00:01.000Z');
		expect((await getPlan(db, plan.id))?.document.brief.stageName).toBe('Two');
		expect(saver.base).toBe('2026-11-22T10:00:01.000Z');
	});

	it('counts a save still in flight as a version the next edit may be based on', async () => {
		const plan = await createPlan(db, { canvas: bay, sourceCanvasId: null });
		const saver = createPlanSaver({ db, planId: plan.id, base: plan.updatedAt, onStale: vi.fn() });
		const saving = saver.save(named('One'), '2026-11-22T10:00:00.000Z');
		expect(saver.bases).toEqual([plan.updatedAt, '2026-11-22T10:00:00.000Z']);
		await saving;
		expect(saver.bases).toEqual(['2026-11-22T10:00:00.000Z']);
	});

	it('saves a share change asked for mid-save after it, with no conflicted copy (Review Focus #5)', async () => {
		const plan = await createPlan(db, { canvas: bay, sourceCanvasId: null });
		const onStale = vi.fn();
		const saver = createPlanSaver({ db, planId: plan.id, base: plan.updatedAt, onStale });
		const share = { id: 'AbCdEfGhIjKlMnOpQrStUv', on: true };
		const saving = saver.save(named('Edited'), new Date().toISOString());
		const sharing = saver.setShare(share);
		expect(saver.bases).toHaveLength(3);
		await Promise.all([saving, sharing]);
		expect(await getPlan(db, plan.id)).toMatchObject({
			share,
			document: { brief: { stageName: 'Edited' } }
		});
		expect(onStale).not.toHaveBeenCalled();
		expect(await db.plans.count()).toBe(1);
		expect(saver.bases).toEqual([saver.base]);
	});

	it("keeps an edit made on a stale plan as a conflicted copy instead of overwriting the other device's version", async () => {
		const plan = await createPlan(db, { canvas: bay, sourceCanvasId: null });
		const onStale = vi.fn();
		const saver = createPlanSaver({
			db,
			planId: plan.id,
			base: plan.updatedAt,
			onStale,
			now: () => new Date('2026-11-22T15:04:00')
		});
		// A pull puts another device's version in place while the editor is open.
		await db.plans.update(plan.id, {
			document: named('Theirs'),
			updatedAt: '2026-11-22T09:00:00.000Z',
			version: 2,
			dirty: 0
		});

		await saver.save(named('Mine'), '2026-11-22T10:00:00.000Z');
		await saver.save(named('Mine, more'), '2026-11-22T10:00:01.000Z');

		expect((await getPlan(db, plan.id))?.document.brief.stageName).toBe('Theirs');
		expect(onStale).toHaveBeenCalledOnce();
		const [copy] = JSON.parse((await getSetting(db, SYNC_CONFLICTS)) ?? '[]') as { id: string }[];
		expect((await getPlan(db, copy.id))?.document.brief.stageName).toBe(
			'Mine, more (conflicted copy, Nov 22 3:04 PM)'
		);
	});
});
