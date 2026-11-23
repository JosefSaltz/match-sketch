import { describe, expect, it } from 'vitest';
import { applyDraft } from '../draft/apply';
import { emptyPlanDocument, type PlanDocument } from '../model/plan';
import { stepsFromText } from '../model/procedure';
import { deleteItems } from './ops';
import { markObjects, pruneMarks, setStepArrows } from './walkthrough';

const popper = crypto.randomUUID();
const box = crypto.randomUUID();
const arrow = crypto.randomUUID();

function stage(): PlanDocument {
	const d = emptyPlanDocument();
	return {
		...d,
		brief: { ...d.brief, steps: stepsFromText([], 'Start in the box\nEngage the popper') },
		objects: [
			{ id: popper, symbolId: 'popper', x: 10, y: 30, rotation: 0, z: 1 },
			{ id: box, symbolId: 'shooting-box', x: 10, y: 5, rotation: 0, z: 0 }
		],
		annotations: [
			{
				id: arrow,
				type: 'arrow',
				from: { kind: 'point', x: 1, y: 1 },
				to: { kind: 'object', objectId: box }
			}
		]
	};
}

const marks = (doc: PlanDocument, i: number) => doc.brief.steps[i].marks;

describe('marking objects in steps', () => {
	it('gives an object one meaning per step, the latest', () => {
		const doc = stage();
		const [one] = doc.brief.steps;
		let next = markObjects(doc, one.id, [popper], 'shoot');
		next = markObjects(next, one.id, [popper, box], 'activate');
		expect(marks(next, 0)).toEqual([
			{ objectId: popper, meaning: 'activate' },
			{ objectId: box, meaning: 'activate' }
		]);
	});

	it('leaves the other steps alone, and clears with null', () => {
		const doc = stage();
		const [one, two] = doc.brief.steps;
		let next = markObjects(doc, one.id, [box], 'start');
		next = markObjects(next, two.id, [popper], 'shoot');
		expect(marks(next, 0)).toEqual([{ objectId: box, meaning: 'start' }]);
		next = markObjects(next, two.id, [popper], null);
		expect(marks(next, 1)).toEqual([]);
		expect(marks(next, 0)).toHaveLength(1);
	});

	it('adds and removes arrows in a step without duplicates', () => {
		const doc = stage();
		const [one] = doc.brief.steps;
		let next = setStepArrows(doc, one.id, [arrow], true);
		next = setStepArrows(next, one.id, [arrow], true);
		expect(next.brief.steps[0].arrows).toEqual([arrow]);
		expect(setStepArrows(next, one.id, [arrow], false).brief.steps[0].arrows).toEqual([]);
	});
});

describe('marks follow what they point at (Review Focus #3)', () => {
	function marked(): PlanDocument {
		const doc = stage();
		const [one, two] = doc.brief.steps;
		const next = markObjects(doc, one.id, [box], 'start');
		return setStepArrows(markObjects(next, two.id, [popper], 'shoot'), two.id, [arrow], true);
	}

	it('drops the marks of a deleted object and a deleted arrow, in every step', () => {
		const next = deleteItems(marked(), [popper, arrow]);
		expect(marks(next, 1)).toEqual([]);
		expect(next.brief.steps[1].arrows).toEqual([]);
		expect(marks(next, 0)).toEqual([{ objectId: box, meaning: 'start' }]);
	});

	it('drops the marks of objects a draft replaces', () => {
		const next = applyDraft(marked(), [{ symbolId: 'popper', x: 5, y: 5, rotation: 0 }]);
		expect(next.brief.steps.flatMap((s) => s.marks)).toEqual([]);
	});

	it('returns the same document when nothing is stale', () => {
		const doc = marked();
		expect(pruneMarks(doc)).toBe(doc);
	});
});
