import { snapPoint } from '../geometry/snap';
import type { CanvasSize, Point } from '../geometry/types';
import type { Anchor, Annotation, LinkAnnotation, PlanDocument } from '../model/plan';
import { clampInside } from './ops';

const MAX_TEXT = 200;

/** Where an anchor sits now; `null` when its object is not in the document. */
export function resolveAnchor(doc: PlanDocument, anchor: Anchor): Point | null {
	if (anchor.kind === 'point') return { x: anchor.x, y: anchor.y };
	const o = doc.objects.find((obj) => obj.id === anchor.objectId);
	return o ? { x: o.x, y: o.y } : null;
}

/** True length of an arrow or measure line in feet; `null` if an end doesn't resolve. */
export function measureFt(doc: PlanDocument, a: LinkAnnotation): number | null {
	const from = resolveAnchor(doc, a.from);
	const to = resolveAnchor(doc, a.to);
	return from && to ? Math.hypot(to.x - from.x, to.y - from.y) : null;
}

/** Position of an object, a text label, or the start of a line, by id. */
export function itemPosition(doc: PlanDocument, id: string): Point | null {
	const o = doc.objects.find((obj) => obj.id === id);
	if (o) return { x: o.x, y: o.y };
	const a = doc.annotations.find((ann) => ann.id === id);
	if (!a) return null;
	return a.type === 'text' ? { x: a.x, y: a.y } : resolveAnchor(doc, a.from);
}

/** The anchor for a pointer: the object under it if there is one, else a snapped point in the bay. */
export function anchorAt(
	doc: PlanDocument,
	hitObjectId: string | null,
	world: Point,
	canvas: CanvasSize,
	step: number | null
): Anchor {
	if (hitObjectId && doc.objects.some((o) => o.id === hitObjectId)) {
		return { kind: 'object', objectId: hitObjectId };
	}
	return { kind: 'point', ...clampInside(snapPoint(world, step), canvas) };
}

export function addAnnotation(doc: PlanDocument, a: Annotation): PlanDocument {
	return { ...doc, annotations: [...doc.annotations, a] };
}

/** Sets a text label's text (trimmed, at most 200 characters); empty text changes nothing. */
export function setText(doc: PlanDocument, id: string, text: string): PlanDocument {
	const next = text.trim().slice(0, MAX_TEXT);
	if (!next) return doc;
	return {
		...doc,
		annotations: doc.annotations.map((a) =>
			a.id === id && a.type === 'text' ? { ...a, text: next } : a
		)
	};
}

export function setAnchor(
	doc: PlanDocument,
	id: string,
	end: 'from' | 'to',
	anchor: Anchor
): PlanDocument {
	return {
		...doc,
		annotations: doc.annotations.map((a) =>
			a.id === id && a.type !== 'text' ? { ...a, [end]: anchor } : a
		)
	};
}
