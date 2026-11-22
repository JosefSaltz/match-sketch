import { describe, it, expect } from 'vitest';
import { PlanDocumentSchema, emptyPlanDocument } from './plan';

describe('plan document schema', () => {
	const doc = emptyPlanDocument();
	const obj = { id: crypto.randomUUID(), symbolId: 'popper', x: 1, y: 2, rotation: 0, z: 0 };

	it('accepts an empty document with the default display settings', () => {
		expect(PlanDocumentSchema.parse(doc)).toEqual(doc);
		expect(doc.display).toEqual({ snap: '1ft', symbolSize: 'medium', showGrid: true });
	});

	it('rejects a count below 1', () => {
		expect(PlanDocumentSchema.safeParse({ ...doc, objects: [{ ...obj, count: 0 }] }).success).toBe(
			false
		);
	});

	it('rejects rotation outside [0, 360)', () => {
		expect(
			PlanDocumentSchema.safeParse({ ...doc, objects: [{ ...obj, rotation: 360 }] }).success
		).toBe(false);
	});

	it('rejects non-finite positions', () => {
		expect(
			PlanDocumentSchema.safeParse({ ...doc, objects: [{ ...obj, x: Number.NaN }] }).success
		).toBe(false);
	});

	it('rejects a scale break whose start is past its end', () => {
		expect(
			PlanDocumentSchema.safeParse({ ...doc, scaleBreaks: [{ fromFt: 50, toFt: 40 }] }).success
		).toBe(false);
	});
});
