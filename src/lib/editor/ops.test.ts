import { describe, it, expect } from 'vitest';
import {
	addObject,
	moveItems,
	setObjectProps,
	deleteItems,
	duplicateObjects,
	reorder
} from './ops';
import { getEntry } from '../catalog/index';
import { emptyPlanDocument, type Annotation, type PlanDocument } from '../model/plan';

const canvas = { widthFt: 150, depthFt: 75 };
const popper = getEntry('popper')!;
const wall = getEntry('wall')!;
const sa = getEntry('shooting-position')!;

describe('addObject', () => {
	it('snaps, defaults rotation/count/z and returns the new id', () => {
		const a = addObject(emptyPlanDocument(), popper, { x: 10.4, y: 20.6 }, canvas, 1);
		expect(a.doc.objects[0]).toMatchObject({
			id: a.id,
			symbolId: 'popper',
			x: 10,
			y: 21,
			rotation: 0,
			count: 1,
			z: 0
		});
	});

	it('gives footprints their default size', () => {
		expect(
			addObject(emptyPlanDocument(), wall, { x: 5, y: 5 }, canvas, null).doc.objects[0]
		).toMatchObject({
			widthFt: 8,
			depthFt: 0.5
		});
	});

	it('auto-labels shooting positions in sequence', () => {
		const s1 = addObject(emptyPlanDocument(), sa, { x: 1, y: 1 }, canvas, null);
		const s2 = addObject(s1.doc, sa, { x: 2, y: 1 }, canvas, null);
		expect(s2.doc.objects.map((o) => o.label)).toEqual(['SA-1', 'SA-2']);
	});

	it('clamps placement inside the bay', () => {
		expect(
			addObject(emptyPlanDocument(), popper, { x: -5, y: 200 }, canvas, null).doc.objects[0]
		).toMatchObject({
			x: 0,
			y: 75
		});
	});
});

describe('editing objects', () => {
	const a = addObject(emptyPlanDocument(), popper, { x: 10.4, y: 20.6 }, canvas, 1);
	const s1 = addObject(emptyPlanDocument(), sa, { x: 1, y: 1 }, canvas, null);
	const s2 = addObject(s1.doc, sa, { x: 2, y: 1 }, canvas, null);

	it('moves without mutating the input, clamped to the bay', () => {
		const before = structuredClone(a.doc);
		const moved = moveItems(a.doc, [a.id], { x: 5, y: -3 }, canvas);
		expect(moved.objects[0]).toMatchObject({ x: 15, y: 18 });
		expect(a.doc).toEqual(before);
		expect(moveItems(a.doc, [a.id], { x: 500, y: 0 }, canvas).objects[0].x).toBe(150);
	});

	it('normalizes rotation and clamps count', () => {
		expect(setObjectProps(a.doc, a.id, { rotation: -90 }, canvas).objects[0].rotation).toBe(270);
		expect(setObjectProps(a.doc, a.id, { count: 0 }, canvas).objects[0].count).toBe(1);
		expect(setObjectProps(a.doc, a.id, { count: 150 }, canvas).objects[0].count).toBe(99);
	});

	it('deletes, ignoring unknown ids', () => {
		expect(deleteItems(a.doc, [a.id, 'missing']).objects).toEqual([]);
	});

	it('duplicates with an offset and a fresh auto label', () => {
		const d = duplicateObjects(s2.doc, [s2.doc.objects[0].id], { x: 1, y: -1 }, canvas);
		expect(d.ids).toHaveLength(1);
		expect(d.doc.objects.at(-1)).toMatchObject({ x: 2, y: 0, label: 'SA-3' });
		expect(d.ids[0]).not.toBe(s2.doc.objects[0].id);
	});

	it('brings an object to the front', () => {
		const front = reorder(s2.doc, s2.doc.objects[0].id, 'front');
		expect(front.objects.find((o) => o.label === 'SA-1')!.z).toBe(2);
	});
});

describe('moveItems into an edge', () => {
	it('stops the whole group at the edge, keeping its spacing', () => {
		const canvas = { widthFt: 150, depthFt: 75 };
		let doc = emptyPlanDocument();
		const a = addObject(doc, getEntry('barrel')!, { x: 10, y: 10 }, canvas, null);
		const b = addObject(a.doc, getEntry('barrel')!, { x: 20, y: 10 }, canvas, null);
		doc = moveItems(b.doc, [a.id, b.id], { x: 200, y: 0 }, canvas);
		expect(doc.objects.map((o) => o.x)).toEqual([140, 150]);
	});
});

describe('annotations in deleteItems and moveItems', () => {
	const canvas = { widthFt: 30, depthFt: 30 };
	const placed = addObject(emptyPlanDocument(), getEntry('barrel')!, { x: 10, y: 5 }, canvas, null);
	const objectId = placed.id;
	const text: Annotation = { id: crypto.randomUUID(), type: 'text', x: 2, y: 2, text: 'Note' };
	const measure: Annotation = {
		id: crypto.randomUUID(),
		type: 'measure',
		from: { kind: 'object', objectId },
		to: { kind: 'point', x: 20, y: 5 }
	};
	const doc: PlanDocument = { ...placed.doc, annotations: [text, measure] };

	it('deleting an object detaches lines attached to it', () => {
		const next = deleteItems(doc, [objectId]);
		expect(next.objects).toEqual([]);
		expect(next.annotations[1]).toMatchObject({ from: { kind: 'point', x: 10, y: 5 } });
	});

	it('deletes annotations by id', () => {
		expect(deleteItems(doc, [text.id]).annotations.map((a) => a.id)).toEqual([measure.id]);
	});

	it('moves text and free line ends with the selection; attached ends stay attached', () => {
		const next = moveItems(doc, [text.id, measure.id], { x: 1, y: 2 }, canvas);
		expect(next.annotations[0]).toMatchObject({ x: 3, y: 4 });
		expect(next.annotations[1]).toMatchObject({
			from: { kind: 'object', objectId },
			to: { kind: 'point', x: 21, y: 7 }
		});
		expect(next.objects[0]).toMatchObject({ x: 10, y: 5 });
	});

	it('clamps the shared delta at the bay edge for annotations too', () => {
		const next = moveItems(doc, [text.id, measure.id], { x: 100, y: 0 }, canvas);
		expect(next.annotations[1]).toMatchObject({ to: { kind: 'point', x: 30, y: 5 } });
		expect(next.annotations[0]).toMatchObject({ x: 12, y: 2 });
	});
});
