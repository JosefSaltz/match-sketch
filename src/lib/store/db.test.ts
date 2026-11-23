import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { emptyPlanDocument } from '../model/plan';
import { createDb } from './db';

/** A plan as an app before schema version 2 stored it. */
function v1Plan(id: string) {
	const { steps, ...brief } = emptyPlanDocument().brief;
	void steps;
	return {
		id,
		version: 3,
		updatedAt: '2026-11-22T10:00:00.000Z',
		deletedAt: null,
		dirty: 0,
		matchId: null,
		stageOrder: null,
		sourceCanvasId: null,
		widthFt: 90,
		depthFt: 60,
		unit: 'yd',
		schemaVersion: 1,
		document: {
			...emptyPlanDocument(),
			brief: { ...brief, stageName: 'Old', procedure: 'Start in box A\nEngage T1' }
		}
	};
}

describe('local database upgrade', () => {
	it('upgrades plans stored at schema version 1 without marking them dirty', async () => {
		const name = `test-${crypto.randomUUID()}`;
		const old = new Dexie(name);
		old.version(3).stores({
			canvases: 'id, name, updatedAt, dirty',
			plans: 'id, updatedAt, matchId, dirty',
			settings: 'key',
			matches: 'id, updatedAt, dirty'
		});
		const id = crypto.randomUUID();
		await old.table('plans').add(v1Plan(id));
		old.close();

		const db = createDb(name);
		const plan = await db.plans.get(id);
		expect(plan?.schemaVersion).toBe(2);
		expect(plan?.dirty).toBe(0);
		expect(plan?.document.brief.stageName).toBe('Old');
		expect(plan?.document.brief.steps.map((s) => s.text)).toEqual(['Start in box A', 'Engage T1']);
		expect(plan?.document.brief).not.toHaveProperty('procedure');
	});
});
