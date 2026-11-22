import { describe, expect, it } from 'vitest';
import { getEntry } from '../catalog';
import { emptyPlanDocument, type PlanDocument } from '../model/plan';
import { applyDraft } from './apply';
import type { DraftPlacement } from './contract';
import { minSpacingFt } from './spacing';
import { validatePlacements } from './validate';

const bay = { widthFt: 90, depthFt: 60 };
const item = (over: Partial<DraftPlacement> = {}): DraftPlacement => ({
	symbolId: 'paper',
	x: 10,
	y: 20,
	rotation: 0,
	label: null,
	count: null,
	widthFt: null,
	depthFt: null,
	...over
});

describe('validatePlacements', () => {
	it('keeps good placements', () => {
		const { valid, problems } = validatePlacements(
			[item(), item({ symbolId: 'barrel', x: 40 })],
			bay
		);
		expect(problems).toEqual([]);
		expect(valid).toHaveLength(2);
	});

	it.each([
		[item({ symbolId: 'unicorn' }), /unknown symbol/],
		[item({ x: 120 }), /outside the bay/],
		[item({ y: -3 }), /outside the bay/],
		[item({ symbolId: 'barrel', count: 3 }), /only targets have a count/],
		[item({ symbolId: 'wall', widthFt: 500 }), /size/]
	])('reports %o', (placement, reason) => {
		const { valid, problems } = validatePlacements([placement], bay);
		expect(valid).toEqual([]);
		expect(problems).toEqual([{ index: 0, reason: expect.stringMatching(reason) as string }]);
	});

	it('reports a repeated label on the second use, not the first', () => {
		const { valid, problems } = validatePlacements(
			[item({ label: 'SA-1' }), item({ label: 'SA-1', x: 30 })],
			bay
		);
		expect(valid).toHaveLength(1);
		expect(problems).toEqual([
			{ index: 1, reason: expect.stringMatching(/label "SA-1" is used twice/) as string }
		]);
	});

	it('normalises rotation and fills a footprint size from the catalog', () => {
		const { valid } = validatePlacements([item({ symbolId: 'wall', rotation: -90 })], bay);
		const wall = getEntry('wall');
		expect(valid[0].rotation).toBe(270);
		expect(wall?.kind === 'footprint' && valid[0].widthFt).toBe(
			wall?.kind === 'footprint' ? wall.footprint.widthFt : null
		);
	});

	it('ignores sizes on fixed-size symbols and clamps counts', () => {
		const { valid } = validatePlacements([item({ widthFt: 9, count: 400 })], bay);
		expect(valid[0]).not.toHaveProperty('widthFt');
		expect(valid[0].count).toBe(99);
	});
});

describe('minSpacingFt', () => {
	it('is the printed symbol size at fit-to-page scale, rounded up to half a foot', () => {
		// A 40 × 300 yd bay is 120 × 900 ft; depth limits the scale to 600 px / 900 ft.
		const spacing = minSpacingFt({ widthFt: 120, depthFt: 900 }, 'medium');
		expect(spacing).toBe(Math.ceil((43.2 / (600 / 900)) * 2) / 2);
		expect(minSpacingFt({ widthFt: 30, depthFt: 20 }, 'small')).toBeGreaterThan(0);
	});
});

describe('applyDraft', () => {
	it('replaces the objects, drops lines tied to them, and keeps text labels', () => {
		const doc: PlanDocument = emptyPlanDocument();
		const old = crypto.randomUUID();
		doc.objects = [{ id: old, symbolId: 'barrel', x: 1, y: 1, rotation: 0, z: 0 }];
		doc.annotations = [
			{ id: crypto.randomUUID(), type: 'text', x: 5, y: 5, text: 'Berm' },
			{
				id: crypto.randomUUID(),
				type: 'measure',
				from: { kind: 'object', objectId: old },
				to: { kind: 'point', x: 9, y: 9 }
			}
		];
		const { valid } = validatePlacements([item(), item({ symbolId: 'barrel', x: 40 })], bay);
		const next = applyDraft(doc, valid);
		expect(next.objects.map((o) => o.symbolId)).toEqual(['paper', 'barrel']);
		expect(next.objects.every((o) => o.id !== old)).toBe(true);
		expect(next.objects.map((o) => o.z)).toEqual([0, 1]);
		expect(next.annotations.map((a) => a.type)).toEqual(['text']);
		expect(next.brief).toBe(doc.brief);
	});
});
