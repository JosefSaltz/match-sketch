import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SHARE_TOKEN } from '../model/share';
import { createCanvas } from './canvases';
import { createDb, type MatchSketchDB } from './db';
import { createMatch, getMatch } from './matches';
import { createPlan, getPlan } from './plans';
import { nextShare, saveMatchShare, savePlanShare } from './share';

let db: MatchSketchDB;
beforeEach(() => {
	db = createDb(`test-${crypto.randomUUID()}`);
});

describe('nextShare', () => {
	it('makes a link when sharing first turns on', () => {
		const s = nextShare(null, 'on');
		expect(s.on).toBe(true);
		expect(s.id).toMatch(SHARE_TOKEN);
	});

	it('keeps the same link through off and on, so printed QR codes work again', () => {
		const on = nextShare(null, 'on');
		const off = nextShare(on, 'off');
		expect(off).toEqual({ id: on.id, on: false });
		expect(nextShare(off, 'on')).toEqual(on);
	});

	it('makes a new link on reset and leaves sharing as it was', () => {
		const on = nextShare(null, 'on');
		const reset = nextShare(on, 'reset');
		expect(reset.id).not.toBe(on.id);
		expect(reset.on).toBe(true);
		expect(nextShare({ ...on, on: false }, 'reset').on).toBe(false);
	});
});

describe('saving a share', () => {
	it('marks the plan for sync and says which version it replaced', async () => {
		const bay = await createCanvas(db, { name: 'Bay', widthFt: 90, depthFt: 60, unit: 'yd' });
		const plan = await createPlan(db, { canvas: bay, sourceCanvasId: bay.id });
		await db.plans.update(plan.id, { dirty: 0 });
		const share = nextShare(null, 'on');
		const result = await savePlanShare(db, plan.id, share);
		expect(await getPlan(db, plan.id)).toMatchObject({ share, dirty: 1 });
		expect(result?.replaced).toBe(plan.updatedAt);
		expect(result!.saved.updatedAt > plan.updatedAt).toBe(true);
	});

	it('marks the match for sync', async () => {
		const match = await createMatch(db, { name: 'SOF', date: '' });
		const share = nextShare(null, 'on');
		await saveMatchShare(db, match.id, share);
		expect(await getMatch(db, match.id)).toMatchObject({ share, dirty: 1 });
	});
});
