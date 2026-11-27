import type { Meaning, PlanDocument, Step } from '../model/plan';

function mapStep(doc: PlanDocument, stepId: string, f: (s: Step) => Step): PlanDocument {
	return {
		...doc,
		brief: { ...doc.brief, steps: doc.brief.steps.map((s) => (s.id === stepId ? f(s) : s)) }
	};
}

/**
 * Marks objects in one walkthrough step with a meaning, replacing any earlier one (one meaning
 * per object per step, spec §7.10); `null` clears their marks.
 */
export function markObjects(
	doc: PlanDocument,
	stepId: string,
	objectIds: string[],
	meaning: Meaning | null
): PlanDocument {
	const ids = new Set(objectIds);
	return mapStep(doc, stepId, (s) => ({
		...s,
		marks: [
			...s.marks.filter((m) => !ids.has(m.objectId)),
			...(meaning ? objectIds.map((objectId) => ({ objectId, meaning })) : [])
		]
	}));
}

/** Shows (or stops showing) arrows in one walkthrough step. */
export function setStepArrows(
	doc: PlanDocument,
	stepId: string,
	arrowIds: string[],
	include: boolean
): PlanDocument {
	const ids = new Set(arrowIds);
	return mapStep(doc, stepId, (s) => ({
		...s,
		arrows: [...s.arrows.filter((id) => !ids.has(id)), ...(include ? arrowIds : [])]
	}));
}

/** Drops marks and arrows whose object or arrow is no longer in the document. */
export function pruneMarks(doc: PlanDocument): PlanDocument {
	const objects = new Set(doc.objects.map((o) => o.id));
	const arrows = new Set(doc.annotations.filter((a) => a.type === 'arrow').map((a) => a.id));
	const stale = doc.brief.steps.some(
		(s) => s.marks.some((m) => !objects.has(m.objectId)) || s.arrows.some((id) => !arrows.has(id))
	);
	if (!stale) return doc;
	return {
		...doc,
		brief: {
			...doc.brief,
			steps: doc.brief.steps.map((s) => ({
				...s,
				marks: s.marks.filter((m) => objects.has(m.objectId)),
				arrows: s.arrows.filter((id) => arrows.has(id))
			}))
		}
	};
}
