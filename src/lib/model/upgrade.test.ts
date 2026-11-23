import { describe, expect, it } from 'vitest';
import { emptyPlanDocument } from './plan';
import { readPlanDocument, type PlanDocumentV1 } from './upgrade';

function v1(procedure: string): PlanDocumentV1 {
	const { steps, ...brief } = emptyPlanDocument().brief;
	void steps;
	return { ...emptyPlanDocument(), brief: { ...brief, stageName: 'Bay drill', procedure } };
}

describe('readPlanDocument', () => {
	it('splits a version 1 procedure into steps, one per line', () => {
		const doc = readPlanDocument(v1('Start in box A\nEngage T1–T4\nMove to B'));
		expect(doc.brief.steps.map((s) => s.text)).toEqual([
			'Start in box A',
			'Engage T1–T4',
			'Move to B'
		]);
		expect(doc.brief.steps.every((s) => s.marks.length === 0 && s.arrows.length === 0)).toBe(true);
		expect(doc.brief.stageName).toBe('Bay drill');
		expect('procedure' in doc.brief).toBe(false);
	});

	it('gives no steps for an empty version 1 procedure', () => {
		expect(readPlanDocument(v1('')).brief.steps).toEqual([]);
	});

	it('passes a version 2 document through unchanged', () => {
		const doc = emptyPlanDocument();
		expect(readPlanDocument(doc)).toEqual(doc);
	});

	it('throws on anything else', () => {
		expect(() => readPlanDocument({ brief: 'nope' })).toThrow();
		expect(() => readPlanDocument(null)).toThrow();
	});
});
