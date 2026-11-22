import { describe, expect, it } from 'vitest';
import { emptyPlanDocument, type Annotation, type PlanDocument } from '../model/plan';
import {
	addAnnotation,
	anchorAt,
	itemPosition,
	measureFt,
	resolveAnchor,
	setAnchor,
	setText
} from './annotations';

const objectId = crypto.randomUUID();
const textId = crypto.randomUUID();
const measureId = crypto.randomUUID();
const text: Annotation = { id: textId, type: 'text', x: 4, y: 6, text: 'Hard cover' };
const measure: Annotation = {
	id: measureId,
	type: 'measure',
	from: { kind: 'object', objectId },
	to: { kind: 'point', x: 3, y: 4 }
};
const doc: PlanDocument = {
	...emptyPlanDocument(),
	objects: [{ id: objectId, symbolId: 'popper', x: 0, y: 0, rotation: 0, z: 0 }],
	annotations: [text, measure]
};
const canvas = { widthFt: 30, depthFt: 30 };

describe('anchors', () => {
	it('an anchor to a missing object resolves to null', () => {
		// Review Focus #4
		expect(resolveAnchor(doc, { kind: 'object', objectId: crypto.randomUUID() })).toBeNull();
	});

	it('resolves objects and points', () => {
		expect(resolveAnchor(doc, { kind: 'object', objectId })).toEqual({ x: 0, y: 0 });
		expect(resolveAnchor(doc, { kind: 'point', x: 3, y: 4 })).toEqual({ x: 3, y: 4 });
	});

	it('anchorAt snaps and clamps free points', () => {
		expect(anchorAt(doc, null, { x: 7.4, y: -2 }, canvas, 1)).toEqual({
			kind: 'point',
			x: 7,
			y: 0
		});
	});

	it('anchorAt attaches to a hit object that exists', () => {
		expect(anchorAt(doc, objectId, { x: 9, y: 9 }, canvas, 1)).toEqual({
			kind: 'object',
			objectId
		});
		expect(anchorAt(doc, crypto.randomUUID(), { x: 9, y: 9 }, canvas, null)).toEqual({
			kind: 'point',
			x: 9,
			y: 9
		});
	});
});

describe('measureFt', () => {
	it('measures between an object and a point', () => {
		expect(measureFt(doc, measure)).toBe(5);
	});

	it('is null when an end does not resolve', () => {
		const lost = { ...measure, from: { kind: 'object' as const, objectId: crypto.randomUUID() } };
		expect(measureFt(doc, lost)).toBeNull();
	});
});

describe('itemPosition', () => {
	it('finds objects, text and the start of a line', () => {
		expect(itemPosition(doc, objectId)).toEqual({ x: 0, y: 0 });
		expect(itemPosition(doc, textId)).toEqual({ x: 4, y: 6 });
		expect(itemPosition(doc, measureId)).toEqual({ x: 0, y: 0 });
		expect(itemPosition(doc, 'missing')).toBeNull();
	});
});

describe('editing annotations', () => {
	it('adds an annotation', () => {
		const a: Annotation = { id: crypto.randomUUID(), type: 'text', x: 1, y: 1, text: 'A' };
		expect(addAnnotation(doc, a).annotations.at(-1)).toEqual(a);
	});

	it('setText trims and caps the text', () => {
		const next = setText(doc, textId, `  ${'x'.repeat(250)}  `);
		expect(next.annotations[0]).toMatchObject({ text: 'x'.repeat(200) });
	});

	it('setText ignores empty text', () => {
		expect(setText(doc, textId, '   ')).toBe(doc);
	});

	it('setAnchor replaces one end', () => {
		const next = setAnchor(doc, measureId, 'to', { kind: 'point', x: 9, y: 9 });
		expect(next.annotations[1]).toMatchObject({ to: { kind: 'point', x: 9, y: 9 } });
	});
});
