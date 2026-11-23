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

	it('accepts the three annotation types and rejects others', () => {
		const text = { id: crypto.randomUUID(), type: 'text', x: 1, y: 2, text: 'Hard cover' };
		const arrow = {
			id: crypto.randomUUID(),
			type: 'arrow',
			from: { kind: 'object', objectId: obj.id },
			to: { kind: 'point', x: 5, y: 6 }
		};
		const measure = { ...arrow, id: crypto.randomUUID(), type: 'measure' };
		const withObj = { ...doc, objects: [obj] };
		expect(
			PlanDocumentSchema.safeParse({ ...withObj, annotations: [text, arrow, measure] }).success
		).toBe(true);
		expect(
			PlanDocumentSchema.safeParse({ ...withObj, annotations: [{ ...text, type: 'circle' }] })
				.success
		).toBe(false);
	});

	it('rejects empty text and malformed anchors', () => {
		const text = { id: crypto.randomUUID(), type: 'text', x: 1, y: 2, text: '' };
		expect(PlanDocumentSchema.safeParse({ ...doc, annotations: [text] }).success).toBe(false);
		const bad = {
			id: crypto.randomUUID(),
			type: 'measure',
			from: { kind: 'object' },
			to: { kind: 'point', x: 1, y: 1 }
		};
		expect(PlanDocumentSchema.safeParse({ ...doc, annotations: [bad] }).success).toBe(false);
	});

	it('accepts the extra large symbol size', () => {
		const display = { ...doc.display, symbolSize: 'xlarge' };
		expect(PlanDocumentSchema.safeParse({ ...doc, display }).success).toBe(true);
	});

	it('accepts an optional guide spacing and rejects a non-positive one', () => {
		const display = { ...doc.display, gridFt: 75 };
		expect(PlanDocumentSchema.safeParse({ ...doc, display }).success).toBe(true);
		expect(PlanDocumentSchema.safeParse(doc).success).toBe(true);
		expect(
			PlanDocumentSchema.safeParse({ ...doc, display: { ...doc.display, gridFt: 0 } }).success
		).toBe(false);
	});
});
