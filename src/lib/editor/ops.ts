import { getEntry, type CatalogEntry } from '../catalog/index';
import { snapPoint } from '../geometry/snap';
import { normalizeDegrees } from '../geometry/transform';
import type { CanvasSize, Point } from '../geometry/types';
import type { PlanDocument, PlanObject } from '../model/plan';
import { nextLabel } from './labels';

export const MIN_SIZE_FT = 0.5;
const MAX_COUNT = 99;
const MAX_LABEL = 24;

export type ObjectPatch = Partial<
	Pick<PlanObject, 'x' | 'y' | 'rotation' | 'label' | 'count' | 'widthFt' | 'depthFt'>
>;

function clampInside(p: Point, canvas: CanvasSize): Point {
	return {
		x: Math.min(canvas.widthFt, Math.max(0, p.x)),
		y: Math.min(canvas.depthFt, Math.max(0, p.y))
	};
}

function topZ(objects: PlanObject[]): number {
	return objects.length ? Math.max(...objects.map((o) => o.z)) + 1 : 0;
}

export function addObject(
	doc: PlanDocument,
	entry: CatalogEntry,
	at: Point,
	canvas: CanvasSize,
	step: number | null
): { doc: PlanDocument; id: string } {
	const { x, y } = clampInside(snapPoint(at, step), canvas);
	const id = crypto.randomUUID();
	const obj: PlanObject = { id, symbolId: entry.id, x, y, rotation: 0, z: topZ(doc.objects) };
	if (entry.countable) obj.count = 1;
	if (entry.kind === 'footprint') {
		obj.widthFt = entry.footprint.widthFt;
		obj.depthFt = entry.footprint.depthFt;
	}
	const label = nextLabel(doc.objects, entry);
	if (label !== undefined) obj.label = label;
	return { doc: { ...doc, objects: [...doc.objects, obj] }, id };
}

/** Moves the objects by one shared delta, stopped at the bay edge so the group keeps its shape. */
export function moveObjects(
	doc: PlanDocument,
	ids: string[],
	delta: Point,
	canvas: CanvasSize
): PlanDocument {
	const selected = new Set(ids);
	const moving = doc.objects.filter((o) => selected.has(o.id));
	if (moving.length) {
		const xs = moving.map((o) => o.x);
		const ys = moving.map((o) => o.y);
		const clampDelta = (d: number, lo: number, hi: number) =>
			lo <= hi ? Math.min(hi, Math.max(lo, d)) : d;
		delta = {
			x: clampDelta(delta.x, -Math.min(...xs), canvas.widthFt - Math.max(...xs)),
			y: clampDelta(delta.y, -Math.min(...ys), canvas.depthFt - Math.max(...ys))
		};
	}
	return {
		...doc,
		objects: doc.objects.map((o) =>
			selected.has(o.id)
				? { ...o, ...clampInside({ x: o.x + delta.x, y: o.y + delta.y }, canvas) }
				: o
		)
	};
}

export function setObjectProps(
	doc: PlanDocument,
	id: string,
	patch: ObjectPatch,
	canvas: CanvasSize
): PlanDocument {
	return {
		...doc,
		objects: doc.objects.map((o) => {
			if (o.id !== id) return o;
			const next: PlanObject = { ...o, ...patch };
			if (patch.rotation !== undefined) next.rotation = normalizeDegrees(patch.rotation);
			if (patch.count !== undefined) {
				next.count = Math.min(MAX_COUNT, Math.max(1, Math.round(patch.count)));
			}
			if (patch.widthFt !== undefined) next.widthFt = Math.max(MIN_SIZE_FT, patch.widthFt);
			if (patch.depthFt !== undefined) next.depthFt = Math.max(MIN_SIZE_FT, patch.depthFt);
			if (patch.label !== undefined) {
				const label = patch.label.trim().slice(0, MAX_LABEL);
				if (label) next.label = label;
				else delete next.label;
			}
			Object.assign(next, clampInside(next, canvas));
			return next;
		})
	};
}

export function deleteObjects(doc: PlanDocument, ids: string[]): PlanDocument {
	const remove = new Set(ids);
	return { ...doc, objects: doc.objects.filter((o) => !remove.has(o.id)) };
}

export function duplicateObjects(
	doc: PlanDocument,
	ids: string[],
	offset: Point,
	canvas: CanvasSize
): { doc: PlanDocument; ids: string[] } {
	const wanted = new Set(ids);
	const objects = [...doc.objects];
	const newIds: string[] = [];
	for (const source of doc.objects) {
		if (!wanted.has(source.id)) continue;
		const copy: PlanObject = {
			...source,
			id: crypto.randomUUID(),
			...clampInside({ x: source.x + offset.x, y: source.y + offset.y }, canvas),
			z: topZ(objects)
		};
		const entry = getEntry(source.symbolId);
		if (entry?.autoLabel) {
			const label = nextLabel(objects, entry);
			if (label !== undefined) copy.label = label;
		}
		objects.push(copy);
		newIds.push(copy.id);
	}
	return { doc: { ...doc, objects }, ids: newIds };
}

export function reorder(doc: PlanDocument, id: string, to: 'front' | 'back'): PlanDocument {
	if (!doc.objects.length) return doc;
	const zs = doc.objects.map((o) => o.z);
	const z = to === 'front' ? Math.max(...zs) + 1 : Math.min(...zs) - 1;
	return { ...doc, objects: doc.objects.map((o) => (o.id === id ? { ...o, z } : o)) };
}
