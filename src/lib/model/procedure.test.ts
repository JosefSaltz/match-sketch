import { describe, expect, it } from 'vitest';
import type { Step } from './plan';
import { displaySteps, procedureText, stepsFromText } from './procedure';

const ids = (steps: Step[]) => steps.map((s) => s.id);
const texts = (steps: Step[]) => steps.map((s) => s.text);

function abc(): Step[] {
	const [a, b, c] = stepsFromText([], 'Start in box A\nEngage T1–T4\nMove to box B');
	const popper = crypto.randomUUID();
	return [a, b, { ...c, marks: [{ objectId: popper, meaning: 'shoot' }] }];
}

describe('stepsFromText', () => {
	it.each(['', 'a', 'a\n\nb', 'a\n'])('round-trips %j through procedureText', (t) => {
		expect(procedureText(stepsFromText([], t))).toBe(t);
	});

	it('gives no steps for an empty procedure', () => {
		expect(stepsFromText([], '')).toEqual([]);
		expect(stepsFromText(abc(), '')).toEqual([]);
	});

	it('starts new steps with no marks or arrows', () => {
		const [s] = stepsFromText([], 'Start');
		expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(s).toEqual({ id: s.id, text: 'Start', marks: [], arrows: [] });
	});

	it('keeps a step id while its line is edited', () => {
		const prev = abc();
		const next = stepsFromText(prev, 'Start in box A\nEngage T1–T5\nMove to box B');
		expect(ids(next)).toEqual(ids(prev));
		expect(next[1].text).toBe('Engage T1–T5');
	});

	it('keeps the later step and its marks when a line is inserted above it', () => {
		const prev = abc();
		const next = stepsFromText(prev, 'Start in box A\nEngage T1–T4\nReload\nMove to box B');
		expect(next).toHaveLength(4);
		expect(next[0].id).toBe(prev[0].id);
		expect(next[1].id).toBe(prev[1].id);
		expect(ids(prev)).not.toContain(next[2].id);
		expect(next[3]).toEqual(prev[2]);
	});

	it('keeps the other steps when a line is deleted', () => {
		const prev = abc();
		const next = stepsFromText(prev, 'Start in box A\nMove to box B');
		expect(ids(next)).toEqual([prev[0].id, prev[2].id]);
		expect(next[1].marks).toEqual(prev[2].marks);
	});

	it('keeps the id on the first part of a split line', () => {
		const prev = abc();
		const next = stepsFromText(prev, 'Start in box A\nEngage T1–T2\nT3–T4\nMove to box B');
		expect(next[1].id).toBe(prev[1].id);
		expect(texts(next)).toEqual(['Start in box A', 'Engage T1–T2', 'T3–T4', 'Move to box B']);
		expect(next[3]).toEqual(prev[2]);
	});

	it('keeps every id when the same text is pasted again', () => {
		const prev = abc();
		expect(stepsFromText(prev, procedureText(prev))).toEqual(prev);
	});

	it('keeps a line its own step while it is cleared and retyped past a blank line', () => {
		const [a, blank, c] = stepsFromText([], 'Start A\n\nEngage T1');
		const marked = [
			{ ...a, marks: [{ objectId: crypto.randomUUID(), meaning: 'start' as const }] },
			blank,
			c
		];
		let steps = marked;
		for (const t of ['Start ', 'S', '', 'Go']) steps = stepsFromText(steps, `${t}\n\nEngage T1`);
		expect(ids(steps)).toEqual(ids(marked));
		expect(steps[0].marks).toEqual(marked[0].marks);
	});

	it("keeps marks on their step when a line passes through another line's text", () => {
		const prev = stepsFromText([], 'Shoot T12\nShoot T1').map((s) => ({
			...s,
			marks: [{ objectId: crypto.randomUUID(), meaning: 'shoot' as const }]
		}));
		let steps = stepsFromText(prev, 'Shoot T1\nShoot T1');
		steps = stepsFromText(steps, 'Shoot T13\nShoot T1');
		expect(ids(steps)).toEqual(ids(prev));
		expect(steps.map((s) => s.marks)).toEqual(prev.map((s) => s.marks));
	});

	it('keeps ids of repeated lines in order', () => {
		const prev = stepsFromText([], 'Reload\nReload');
		expect(ids(stepsFromText(prev, 'Reload\nReload'))).toEqual(ids(prev));
	});
});

describe('displaySteps', () => {
	it('drops blank lines and strips the numbers people type', () => {
		const steps = stepsFromText([], '1. Start in box A\n\n  2) Engage T1  \nMove');
		const shown = displaySteps(steps);
		expect(texts(shown)).toEqual(['Start in box A', 'Engage T1', 'Move']);
		expect(ids(shown)).toEqual([steps[0].id, steps[2].id, steps[3].id]);
	});
});
