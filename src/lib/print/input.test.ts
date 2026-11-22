import { describe, expect, it } from 'vitest';
import { emptyPlanDocument } from '../model/plan';
import type { PlanRecord } from '../store/records';
import { printInput } from './input';

const base: PlanRecord = {
	id: 'p1',
	version: 0,
	updatedAt: '2026-11-22T00:00:00.000Z',
	deletedAt: null,
	dirty: 1,
	matchId: null,
	stageOrder: null,
	sourceCanvasId: null,
	widthFt: 120,
	depthFt: 900,
	unit: 'yd',
	schemaVersion: 1,
	document: emptyPlanDocument()
};

describe('printInput', () => {
	it('names an untitled stage and leaves match fields empty without a match', () => {
		const i = printInput(base, null, { orientation: 'portrait', mode: 'fit' });
		expect(i).toMatchObject({ title: 'Untitled stage', stageNumber: '', matchName: '', date: '' });
		expect(i.depth).toBeNull();
	});

	it('takes the stage number, match name and date from the match', () => {
		const i = printInput(
			base,
			{ name: 'DRRC November', date: '2026-11-29', order: ['x', 'p1'] },
			{
				orientation: 'portrait',
				mode: 'fit'
			}
		);
		expect(i.stageNumber).toBe('2');
		expect(i.matchName).toBe('DRRC November');
		expect(i.date).toContain('2026');
	});

	it('carries the scale break and the targets text', () => {
		const doc = {
			...emptyPlanDocument(),
			scaleBreaks: [{ fromFt: 90, toFt: 900 }],
			brief: { ...emptyPlanDocument().brief, targetsOverride: '6 paper' }
		};
		const i = printInput({ ...base, document: doc }, null, {
			orientation: 'landscape',
			mode: 'fit'
		});
		expect(i.depth).toEqual({ fromFt: 90, toFt: 900, drawnFt: 75 });
		expect(i.targets).toBe('6 paper');
		expect(i.orientation).toBe('landscape');
	});
});
